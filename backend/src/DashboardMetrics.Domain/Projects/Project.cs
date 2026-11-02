namespace DashboardMetrics.Domain.Projects;

public sealed class Project
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public string Description { get; set; } = "";
    public string? ApiRepoOwner { get; set; }
    public string? ApiRepoName { get; set; }
    public string ApiBranch { get; set; } = "automation-metrics";
    public string? UiRepoOwner { get; set; }
    public string? UiRepoName { get; set; }
    public string UiBranch { get; set; } = "automation-metrics";
    public string? ApiExecutionsUrl { get; set; }
    public string? ApiEvolutionUrl { get; set; }
    public string? UiExecutionsUrl { get; set; }
    public string? UiEvolutionUrl { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSyncedAt { get; set; }
    public string? LastSyncError { get; set; }
}
