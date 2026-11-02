namespace DashboardMetrics.Domain.Widgets;

public interface IWidgetRepository
{
    Task<IReadOnlyList<DashboardWidget>> ListAsync(string? projectId, string product, CancellationToken cancellationToken = default);
    Task InsertAsync(DashboardWidget widget, CancellationToken cancellationToken = default);
    Task<bool> ReplaceAsync(DashboardWidget widget, CancellationToken cancellationToken = default);
    Task<DashboardWidget?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
    Task DeleteScopeAsync(string? projectId, string product, CancellationToken cancellationToken = default);
    Task DeleteProjectAsync(string projectId, CancellationToken cancellationToken = default);
}
