namespace DashboardMetrics.Domain.Projects;

public interface IProjectRepository
{
    Task<IReadOnlyList<Project>> ListAsync(CancellationToken cancellationToken = default);
    Task<Project?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
    Task<Project?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task InsertAsync(Project project, CancellationToken cancellationToken = default);
    Task<bool> ReplaceAsync(Project project, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}
