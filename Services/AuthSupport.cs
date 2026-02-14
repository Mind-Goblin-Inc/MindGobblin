using System.Security.Cryptography;
using System.Text;

static class AuthSupport
{
    private const int PasswordIterations = 120_000;
    private const int PasswordHashBytes = 32;

    public static string NormalizeUsername(string username) => username.Trim().ToLowerInvariant();

    public static bool IsValidUsername(string username)
    {
        if (string.IsNullOrWhiteSpace(username)) return false;
        if (username.Length < 3 || username.Length > 32) return false;
        return username.All(c => char.IsLetterOrDigit(c) || c is '_' or '-' or '.');
    }

    public static bool IsValidPassword(string password)
    {
        return !string.IsNullOrWhiteSpace(password) && password.Length >= 8 && password.Length <= 128;
    }

    public static string HashPassword(string password, string saltBase64)
    {
        var salt = Convert.FromBase64String(saltBase64);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, PasswordHashBytes);
        return Convert.ToBase64String(hash);
    }

    public static bool SlowEquals(string a, string b)
    {
        var left = Encoding.UTF8.GetBytes(a);
        var right = Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(left, right);
    }

    public static void SetAuthSession(HttpContext ctx, UserAccount user)
    {
        ctx.Session.SetString("auth_user_id", user.Id.ToString());
        ctx.Session.SetString("auth_username", user.Username);
    }

    public static void ClearAuthSession(HttpContext ctx)
    {
        ctx.Session.Remove("auth_user_id");
        ctx.Session.Remove("auth_username");
    }

    public static int? GetAuthenticatedUserId(HttpContext ctx)
    {
        var userIdText = ctx.Session.GetString("auth_user_id");
        return int.TryParse(userIdText, out var userId) ? userId : null;
    }
}
