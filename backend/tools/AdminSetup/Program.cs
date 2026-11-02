using Microsoft.AspNetCore.Identity;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

if (Console.IsInputRedirected) throw new InvalidOperationException("Use um terminal interativo para configurar o administrador.");
var output = Path.GetFullPath(Path.Combine("backend", "src", "DashboardMetrics.Api", "admin.local.json"));
var reset = args.Length == 1 && args[0] == "--reset";
string email;
if (reset)
{
    if (!File.Exists(output)) throw new InvalidOperationException("Administrador ainda não configurado.");
    using var existing = JsonDocument.Parse(await File.ReadAllTextAsync(output));
    email = existing.RootElement.GetProperty("AdminAuth").GetProperty("Email").GetString() ?? "";
    Console.WriteLine("Definindo uma nova senha para o administrador já cadastrado.");
}
else
{
    Console.Write("E-mail do administrador: ");
    email = Console.ReadLine()?.Trim() ?? "";
}
if (email.Length > 255 || !Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$"))
    throw new ArgumentException("E-mail inválido.");

static string ReadPassword(string prompt)
{
    Console.Write(prompt);
    var input = new StringBuilder();
    while (true)
    {
        var key = Console.ReadKey(intercept: true);
        if (key.Key == ConsoleKey.Enter) break;
        if (key.Key == ConsoleKey.Backspace) { if (input.Length > 0) input.Length--; continue; }
        if (!char.IsControl(key.KeyChar)) input.Append(key.KeyChar);
    }
    Console.WriteLine();
    return input.ToString();
}

var password = ReadPassword("Senha (não será exibida): ");
var confirmation = ReadPassword("Confirme a senha: ");
if (password.Length < 12 || password.Length > 256 || password != confirmation)
    throw new ArgumentException("As senhas devem ser iguais e ter entre 12 e 256 caracteres.");
var hash = new PasswordHasher<string>().HashPassword(email, password);
if (reset)
{
    var temporary = output + "." + Guid.NewGuid().ToString("N") + ".tmp";
    var backup = output + "." + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff") + ".bak";
    await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        await JsonSerializer.SerializeAsync(stream, new { AdminAuth = new { Email = email, PasswordHash = hash } }, new JsonSerializerOptions { WriteIndented = true });
    File.Replace(temporary, output, backup);
    Console.WriteLine("Senha redefinida para o administrador existente.");
}
else
{
    await using var stream = new FileStream(output, FileMode.CreateNew, FileAccess.Write, FileShare.None);
    await JsonSerializer.SerializeAsync(stream, new { AdminAuth = new { Email = email, PasswordHash = hash } }, new JsonSerializerOptions { WriteIndented = true });
    Console.WriteLine("Administrador configurado.");
}
