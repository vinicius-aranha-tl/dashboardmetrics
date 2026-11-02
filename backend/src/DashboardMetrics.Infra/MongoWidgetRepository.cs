using DashboardMetrics.Domain.Widgets;
using MongoDB.Driver;

namespace DashboardMetrics.Infra;

public sealed class MongoWidgetRepository(IMongoDatabase database) : IWidgetRepository
{
    private readonly IMongoCollection<DashboardWidget> _widgets = database.GetCollection<DashboardWidget>("dashboard_widgets");

    public async Task<IReadOnlyList<DashboardWidget>> ListAsync(string? projectId, string product, CancellationToken cancellationToken = default) =>
        await _widgets.Find(w => w.ProjectId == projectId && w.Product == product).SortBy(w => w.Position).ToListAsync(cancellationToken);

    public Task InsertAsync(DashboardWidget widget, CancellationToken cancellationToken = default) =>
        _widgets.InsertOneAsync(widget, cancellationToken: cancellationToken);

    public async Task<bool> ReplaceAsync(DashboardWidget widget, CancellationToken cancellationToken = default) =>
        (await _widgets.ReplaceOneAsync(w => w.Id == widget.Id, widget, cancellationToken: cancellationToken)).MatchedCount > 0;

    public async Task<DashboardWidget?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        await _widgets.Find(w => w.Id == id).FirstOrDefaultAsync(cancellationToken);

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        (await _widgets.DeleteOneAsync(w => w.Id == id, cancellationToken)).DeletedCount > 0;

    public async Task DeleteScopeAsync(string? projectId, string product, CancellationToken cancellationToken = default) =>
        await _widgets.DeleteManyAsync(w => w.ProjectId == projectId && w.Product == product, cancellationToken);

    public async Task DeleteProjectAsync(string projectId, CancellationToken cancellationToken = default) =>
        await _widgets.DeleteManyAsync(w => w.ProjectId == projectId, cancellationToken);
}
