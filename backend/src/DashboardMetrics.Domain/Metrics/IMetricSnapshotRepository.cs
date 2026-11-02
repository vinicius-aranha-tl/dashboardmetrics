namespace DashboardMetrics.Domain.Metrics;

public interface IMetricSnapshotRepository
{
    Task<string?> GetLatestAsync(string projectId, CancellationToken cancellationToken = default);
    Task SaveAsync(string projectId, string json, CancellationToken cancellationToken = default);
}
