record PlaceUpdate(int X, int Y, byte ColorIndex, long Ts);

static class PlaceBoard
{
    public const int Width = 256;
    public const int Height = 256;

    public static readonly string DataPath =
        Environment.GetEnvironmentVariable("PLACE_DATA_PATH")
        ?? "/data/place-board.bin";

    public static readonly string[] Palette = new[]
    {
        "#000000", "#FF4500", "#FFFFFF", "#FFA800", "#FFD635",
        "#00A368", "#00CC78", "#7EED56", "#2450A4", "#3690EA",
        "#51E9F4", "#811E9F", "#B44AC0", "#FF99AA", "#9C6926",
        "#6D482F", "#BE0039", "#FFB470", "#515252", "#898D90"
    };

    public static readonly byte[] Pixels = new byte[Width * Height];
    public static readonly object Gate = new();

    public static readonly Queue<PlaceUpdate> Recent = new();
    public static long LastTs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public static void Load()
    {
        try
        {
            Console.WriteLine($"[place] Using data path: {DataPath}");
            var dir = Path.GetDirectoryName(DataPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Console.WriteLine($"[place] Creating directory: {dir}");
                Directory.CreateDirectory(dir);
            }

            if (File.Exists(DataPath))
            {
                var buf = File.ReadAllBytes(DataPath);
                if (buf.Length == Pixels.Length)
                {
                    Array.Copy(buf, Pixels, buf.Length);
                    Console.WriteLine("[place] Board loaded from data file.");
                }
                else
                {
                    Console.WriteLine($"[place] Existing file length {buf.Length} != {Pixels.Length}; starting fresh.");
                }
            }
            else
            {
                Console.WriteLine("[place] No existing board file; starting fresh.");
                Save();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("[place] Load error: " + ex);
        }
    }

    public static void Save()
    {
        try
        {
            var dir = Path.GetDirectoryName(DataPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            File.WriteAllBytes(DataPath, Pixels);
        }
        catch (Exception ex)
        {
            Console.WriteLine("[place] Save error: " + ex.Message);
        }
    }

    public static void AddUpdate(int x, int y, byte color)
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        LastTs = ts;
        Recent.Enqueue(new PlaceUpdate(x, y, color, ts));
        while (Recent.Count > 5000) Recent.Dequeue();
    }
}

static class PlaceSessionCooldown
{
    public static bool Check(HttpContext ctx, int cooldownSeconds, out int remainSeconds)
    {
        var key = "place_last_ts";
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var lastStr = ctx.Session.GetString(key);
        if (long.TryParse(lastStr, out var last))
        {
            var remain = (last + cooldownSeconds) - now;
            if (remain > 0)
            {
                remainSeconds = (int)remain;
                return false;
            }
        }

        ctx.Session.SetString(key, now.ToString());
        remainSeconds = 0;
        return true;
    }
}
