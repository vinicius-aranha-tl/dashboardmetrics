using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using DashboardMetrics.Domain.Projects;
using DashboardMetrics.Domain.Widgets;
using DashboardMetrics.Domain.Metrics;

namespace DashboardMetrics.Infra;

public static class MongoConfiguration
{
    public static IServiceCollection AddMongoDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = configuration["MongoDbOptions:ConnectionString"]
            ?? throw new InvalidOperationException("Configure a conexão do MongoDB.");
        var name = configuration["MongoDbOptions:DatabaseName"]
            ?? throw new InvalidOperationException("Configure o nome do banco MongoDB.");
        services.AddSingleton<IMongoClient>(_ => new MongoClient(connection));
        services.AddSingleton(provider => provider.GetRequiredService<IMongoClient>().GetDatabase(name));
        services.AddScoped<IProjectRepository, MongoProjectRepository>();
        services.AddScoped<IWidgetRepository, MongoWidgetRepository>();
        services.AddScoped<IMetricSnapshotRepository, MongoMetricSnapshotRepository>();
        return services;
    }
}
