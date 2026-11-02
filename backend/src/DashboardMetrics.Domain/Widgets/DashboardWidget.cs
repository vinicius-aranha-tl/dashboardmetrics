namespace DashboardMetrics.Domain.Widgets;

public sealed class DashboardWidget
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? ProjectId { get; set; }
    public string Product { get; set; } = "";
    public string WidgetType { get; set; } = "";
    public string Title { get; set; } = "";
    public string Width { get; set; } = "half";
    public int Position { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
