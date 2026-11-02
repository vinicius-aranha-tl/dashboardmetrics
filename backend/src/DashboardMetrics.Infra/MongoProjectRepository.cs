using DashboardMetrics.Domain.Projects;
using MongoDB.Driver;

namespace DashboardMetrics.Infra;

public sealed class MongoProjectRepository(IMongoDatabase database) : IProjectRepository
{
    private readonly IMongoCollection<Project> _projects = database.GetCollection<Project>("projects");

    public async Task<IReadOnlyList<Project>> ListAsync(CancellationToken cancellationToken = default) =>
        await _projects.Find(FilterDefinition<Project>.Empty).SortBy(p => p.Name).ToListAsync(cancellationToken);

    public async Task<Project?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        await _projects.Find(p => p.Slug == slug).FirstOrDefaultAsync(cancellationToken);

    public async Task<Project?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        await _projects.Find(p => p.Id == id).FirstOrDefaultAsync(cancellationToken);

    private Task<string> EnsureSlugIndexAsync(CancellationToken cancellationToken) =>
        _projects.Indexes.CreateOneAsync(new CreateIndexModel<Project>(
            Builders<Project>.IndexKeys.Ascending(p => p.Slug), new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);

    public async Task InsertAsync(Project project, CancellationToken cancellationToken = default)
    {
        await EnsureSlugIndexAsync(cancellationToken);
        await _projects.InsertOneAsync(project, cancellationToken: cancellationToken);
    }

    public async Task<bool> ReplaceAsync(Project project, CancellationToken cancellationToken = default)
    {
        await EnsureSlugIndexAsync(cancellationToken);
        return (await _projects.ReplaceOneAsync(p => p.Id == project.Id, project, cancellationToken: cancellationToken)).MatchedCount > 0;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        (await _projects.DeleteOneAsync(p => p.Id == id, cancellationToken)).DeletedCount > 0;
}
