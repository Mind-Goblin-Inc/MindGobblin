using Microsoft.EntityFrameworkCore;

static class TetrisEndpoints
{
    public static void MapTetrisEndpoints(this WebApplication app)
    {
        app.MapGet("/api/tetrisscoreshl", async (MindGoblinDbContext db, int? playerId) =>
        {
            try
            {
                var allScores = await db.TetrisScores
                    .OrderByDescending(s => s.Points)
                    .ToListAsync();

                var ranked = allScores
                    .Select((s, i) => new { Placement = i + 1, s.Id, s.Player, s.Points })
                    .ToList();

                var top10 = ranked.Take(10).ToList();
                var playerRow = playerId.HasValue ? ranked.FirstOrDefault(r => r.Id == playerId.Value) : null;

                return Results.Json(new { Top = top10, Player = playerRow });
            }
            catch (Exception ex)
            {
                Console.WriteLine("Database read error: " + ex.Message);
                return Results.Problem("Error reading from database.");
            }
        });

        app.MapGet("/api/tetrisscores", async (MindGoblinDbContext db) =>
        {
            try
            {
                var scores = await db.TetrisScores
                    .OrderByDescending(s => s.Points)
                    .Take(10)
                    .ToListAsync();

                return Results.Json(scores);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Database read error: " + ex.Message);
                return Results.Problem("Error reading from database.");
            }
        });

        app.MapPost("/api/tetrisscores", async (MindGoblinDbContext db, TetrisScore score) =>
        {
            try
            {
                db.TetrisScores.Add(score);
                await db.SaveChangesAsync();
                return Results.Created($"/api/tetrisscores/{score.Id}", score);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Database write error: " + ex.Message);
                return Results.Problem("Error writing to database.");
            }
        });
    }
}
