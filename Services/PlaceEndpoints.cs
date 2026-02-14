using System.Text;
using System.Text.Json;

static class PlaceEndpoints
{
    public static void MapPlaceEndpoints(this WebApplication app)
    {
        app.MapGet("/api/place/meta", () =>
        {
            return Results.Json(new
            {
                width = PlaceBoard.Width,
                height = PlaceBoard.Height,
                palette = PlaceBoard.Palette,
                cooldownSeconds = 1,
                since = PlaceBoard.LastTs
            });
        });

        app.MapGet("/api/place/board", () =>
        {
            lock (PlaceBoard.Gate)
            {
                var base64 = Convert.ToBase64String(PlaceBoard.Pixels);
                return Results.Text(base64, "text/plain", Encoding.UTF8);
            }
        });

        app.MapGet("/api/place/updates", (long? since) =>
        {
            var s = since ?? 0;
            lock (PlaceBoard.Gate)
            {
                var ups = PlaceBoard.Recent.Where(u => u.Ts > s).ToArray();
                return Results.Json(new { since = PlaceBoard.LastTs, updates = ups });
            }
        });

        app.MapPost("/api/place/set", async (HttpContext ctx) =>
        {
            using var doc = await JsonDocument.ParseAsync(ctx.Request.Body);
            var root = doc.RootElement;

            if (!root.TryGetProperty("x", out var xEl) || !root.TryGetProperty("y", out var yEl) || !root.TryGetProperty("colorIndex", out var cEl))
                return Results.BadRequest(new { error = "x, y, colorIndex required" });

            int x = xEl.GetInt32();
            int y = yEl.GetInt32();
            int ci = cEl.GetInt32();

            if (x < 0 || y < 0 || x >= PlaceBoard.Width || y >= PlaceBoard.Height)
                return Results.BadRequest(new { error = "out of bounds" });

            if (ci < 0 || ci >= PlaceBoard.Palette.Length)
                return Results.BadRequest(new { error = "invalid colorIndex" });

            const int cooldown = 1;
            if (!PlaceSessionCooldown.Check(ctx, cooldown, out var remain))
            {
                return Results.Json(new { error = "cooldown", seconds = remain }, statusCode: 429);
            }

            lock (PlaceBoard.Gate)
            {
                PlaceBoard.Pixels[y * PlaceBoard.Width + x] = (byte)ci;
                PlaceBoard.AddUpdate(x, y, (byte)ci);
                PlaceBoard.Save();
            }

            return Results.Ok(new { ok = true, since = PlaceBoard.LastTs });
        });
    }
}
