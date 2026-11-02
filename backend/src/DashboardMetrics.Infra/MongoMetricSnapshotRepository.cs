using DashboardMetrics.Domain.Metrics;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace DashboardMetrics.Infra;

public sealed class MongoMetricSnapshotRepository(IMongoDatabase database) : IMetricSnapshotRepository
{
    public async Task<string?> GetLatestAsync(string projectId, CancellationToken cancellationToken = default)
    {
        var snapshots = database.GetCollection<BsonDocument>("metric_snapshots");
        var snapshot = await snapshots.Find(Builders<BsonDocument>.Filter.Eq("projectId", projectId))
            .Sort(Builders<BsonDocument>.Sort.Descending("syncedAt")).FirstOrDefaultAsync(cancellationToken);
        if (snapshot is null) return null;

        var dataset = snapshot["dataset"].AsBsonDocument;
        var fingerprint = dataset.GetValue("sourceFingerprint", "").AsString;
        var filter = Builders<BsonDocument>.Filter.Eq("projectId", projectId) & Builders<BsonDocument>.Filter.Eq("sourceFingerprint", fingerprint);
        var runs = await database.GetCollection<BsonDocument>("metric_executions").Find(filter)
            .Sort(Builders<BsonDocument>.Sort.Ascending("date")).ToListAsync(cancellationToken);
        dataset["executions"] = new BsonArray(runs.Select(run => run["data"]));
        var points = await database.GetCollection<BsonDocument>("metric_evolution").Find(filter)
            .Sort(Builders<BsonDocument>.Sort.Ascending("week")).ToListAsync(cancellationToken);
        dataset["evolution"] = new BsonDocument {
            { "api", new BsonArray(points.Where(point => point["product"] == "api").Select(point => point["data"])) },
            { "ui", new BsonArray(points.Where(point => point["product"] == "ui").Select(point => point["data"])) }
        };
        return dataset.ToJson(new MongoDB.Bson.IO.JsonWriterSettings { OutputMode = MongoDB.Bson.IO.JsonOutputMode.RelaxedExtendedJson });
    }

    public async Task SaveAsync(string projectId, string json, CancellationToken cancellationToken = default)
    {
        var dataset = BsonDocument.Parse(json);
        var fingerprint = dataset["sourceFingerprint"].AsString;
        var runWrites = new List<WriteModel<BsonDocument>>();
        foreach (var value in dataset["executions"].AsBsonArray)
        {
            if (!value.IsBsonDocument) continue;
            var run = value.AsBsonDocument;
            if (run.GetValue("trigger", "").AsString != "scheduled") continue;
            var runId = run.GetValue("id", "").AsString;
            var product = run.GetValue("product", "").AsString;
            if (string.IsNullOrEmpty(runId) || product is not ("api" or "ui")) continue;
            var attempt = run.GetValue("runAttempt", 1).ToString() ?? "1";
            var recordId = RecordId(projectId, fingerprint, product, runId, attempt);
            var record = new BsonDocument { { "_id", recordId }, { "projectId", projectId }, { "sourceFingerprint", fingerprint }, { "date", run.GetValue("date", "") }, { "data", run } };
            runWrites.Add(new ReplaceOneModel<BsonDocument>(Builders<BsonDocument>.Filter.Eq("_id", recordId), record) { IsUpsert = true });
        }
        if (runWrites.Count > 0) await database.GetCollection<BsonDocument>("metric_executions").BulkWriteAsync(runWrites, cancellationToken: cancellationToken);

        var pointWrites = new List<WriteModel<BsonDocument>>();
        foreach (var product in new[] { "api", "ui" })
        {
            var series = dataset["evolution"].AsBsonDocument.GetValue(product, new BsonArray());
            if (!series.IsBsonArray) continue;
            foreach (var value in series.AsBsonArray)
            {
                if (!value.IsBsonDocument) continue;
                var point = value.AsBsonDocument;
                var week = point.GetValue("week", "").AsString;
                if (string.IsNullOrEmpty(week)) continue;
                var recordId = RecordId(projectId, fingerprint, product, week);
                var record = new BsonDocument { { "_id", recordId }, { "projectId", projectId }, { "sourceFingerprint", fingerprint }, { "product", product }, { "week", week }, { "data", point } };
                pointWrites.Add(new ReplaceOneModel<BsonDocument>(Builders<BsonDocument>.Filter.Eq("_id", recordId), record) { IsUpsert = true });
            }
        }
        if (pointWrites.Count > 0) await database.GetCollection<BsonDocument>("metric_evolution").BulkWriteAsync(pointWrites, cancellationToken: cancellationToken);

        var now = DateTime.UtcNow;
        var key = $"{projectId}:{now:yyyy-MM-dd}";
        dataset["executions"] = new BsonArray();
        dataset["evolution"] = new BsonDocument { { "api", new BsonArray() }, { "ui", new BsonArray() } };
        var document = new BsonDocument { { "_id", key }, { "projectId", projectId }, { "syncedAt", now }, { "dataset", dataset } };
        await database.GetCollection<BsonDocument>("metric_snapshots").ReplaceOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", key), document, new ReplaceOptions { IsUpsert = true }, cancellationToken);
    }

    private static string RecordId(params string[] parts) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(parts))));
}
