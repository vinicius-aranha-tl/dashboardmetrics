using DashboardMetrics.Domain.Projects;
using DashboardMetrics.Domain.Widgets;
using DashboardMetrics.Infra;
using MongoDB.Driver;
using MongoDB.Bson;
using System.Text.Json;

// Explicitly restricted to the test database on this machine.
var database = new MongoClient("mongodb://127.0.0.1:27017").GetDatabase("dashboardmetrics_migration_tests");
var projects = new MongoProjectRepository(database);
var widgets = new MongoWidgetRepository(database);
var snapshots = new MongoMetricSnapshotRepository(database);
var project = new Project { Name = "Smoke test", Slug = $"test-{Guid.NewGuid():N}" };
var widget = new DashboardWidget { ProjectId = project.Id, Product = "api", WidgetType = "success_gauge", Title = "Test", Position = 1 };

try
{
    await projects.InsertAsync(project);
    var loaded = await projects.GetBySlugAsync(project.Slug) ?? throw new Exception("Project not found");
    if (loaded.Id != project.Id) throw new Exception("Project identity mismatch");
    loaded.Name = "Updated";
    if (!await projects.ReplaceAsync(loaded) || (await projects.GetByIdAsync(project.Id))?.Name != "Updated")
        throw new Exception("Project update failed");
    await widgets.InsertAsync(widget);
    if (!(await widgets.ListAsync(project.Id, "api")).Any(w => w.Id == widget.Id))
        throw new Exception("Widget not found in project");
    if ((await widgets.ListAsync(null, "api")).Any(w => w.Id == widget.Id))
        throw new Exception("Widget leaked into overview");
    widget.Title = "Updated";
    if (!await widgets.ReplaceAsync(widget) || (await widgets.GetByIdAsync(widget.Id))?.Title != "Updated")
        throw new Exception("Widget update failed");
    var dataset = JsonSerializer.Serialize(new {
        project = new { id = project.Id }, sourceFingerprint = "smoke",
        executions = new object[] { new { id = "run-1", trigger = "scheduled", product = "api", runAttempt = 1, date = "2026-10-30" }, new { id = "manual-1", trigger = "manual", product = "api", runAttempt = 1 } },
        evolution = new { api = new[] { new { week = "2026-10-26", productConditions = 10, automatedConditions = 2 } }, ui = Array.Empty<object>() },
        sources = new { }, special = new { }
    });
    await snapshots.SaveAsync(project.Id, dataset);
    await snapshots.SaveAsync(project.Id, dataset);
    using var saved = JsonDocument.Parse(await snapshots.GetLatestAsync(project.Id) ?? throw new Exception("Snapshot not found"));
    if (saved.RootElement.GetProperty("executions").GetArrayLength() != 1 || saved.RootElement.GetProperty("evolution").GetProperty("api").GetArrayLength() != 1)
        throw new Exception("Snapshot deduplication or scheduled filter failed");
    Console.WriteLine("MongoDB project, widget and metric snapshot checks passed.");
}
finally
{
    await widgets.DeleteAsync(widget.Id);
    await projects.DeleteAsync(project.Id);
    foreach (var name in new[] { "metric_snapshots", "metric_executions", "metric_evolution" })
        await database.GetCollection<BsonDocument>(name).DeleteManyAsync(Builders<BsonDocument>.Filter.Eq("projectId", project.Id));
}
