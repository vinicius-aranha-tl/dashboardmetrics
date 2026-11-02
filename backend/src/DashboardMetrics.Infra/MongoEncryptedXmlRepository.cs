using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DashboardMetrics.Infra;

/// <summary>Persists ASP.NET session keys encrypted at rest. The encryption key stays outside MongoDB.</summary>
public sealed class MongoEncryptedXmlRepository : IXmlRepository
{
    private readonly IMongoCollection<BsonDocument> _keys;
    private readonly byte[] _encryptionKey;

    public MongoEncryptedXmlRepository(IMongoDatabase database, string encodedKey)
    {
        _keys = database.GetCollection<BsonDocument>("data_protection_keys");
        try { _encryptionKey = Convert.FromBase64String(encodedKey); }
        catch (FormatException) { throw new InvalidOperationException("A chave de proteção deve estar em Base64."); }
        if (_encryptionKey.Length != 32) throw new InvalidOperationException("A chave de proteção deve ter 32 bytes.");
    }

    public IReadOnlyCollection<XElement> GetAllElements()
    {
        var documents = _keys.Find(FilterDefinition<BsonDocument>.Empty).ToList();
        return documents.Select(document =>
        {
            var nonce = document["nonce"].AsBsonBinaryData.Bytes;
            var ciphertext = document["ciphertext"].AsBsonBinaryData.Bytes;
            var tag = document["tag"].AsBsonBinaryData.Bytes;
            var plaintext = new byte[ciphertext.Length];
            using var aes = new AesGcm(_encryptionKey, 16);
            aes.Decrypt(nonce, ciphertext, tag, plaintext);
            return XElement.Parse(Encoding.UTF8.GetString(plaintext));
        }).ToArray();
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        var plaintext = Encoding.UTF8.GetBytes(element.ToString(SaveOptions.DisableFormatting));
        var nonce = RandomNumberGenerator.GetBytes(12);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_encryptionKey, 16);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);
        _keys.InsertOne(new BsonDocument { { "_id", friendlyName }, { "nonce", nonce }, { "ciphertext", ciphertext }, { "tag", tag } });
    }
}
