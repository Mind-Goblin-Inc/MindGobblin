using Microsoft.EntityFrameworkCore;

public class MindGoblinDbContext : DbContext
{
    public MindGoblinDbContext(DbContextOptions<MindGoblinDbContext> options) : base(options) { }

    public DbSet<TetrisScore> TetrisScores { get; set; } = default!;
    public DbSet<PongGameLobby> PongGameLobbies { get; set; } = default!;
    public DbSet<UserAccount> UserAccounts { get; set; } = default!;
    public DbSet<EuchreGroup> EuchreGroups { get; set; } = default!;
    public DbSet<EuchreGroupEditor> EuchreGroupEditors { get; set; } = default!;
    public DbSet<EuchrePlayer> EuchrePlayers { get; set; } = default!;
    public DbSet<EuchreGame> EuchreGames { get; set; } = default!;
    public DbSet<EuchreGameParticipant> EuchreGameParticipants { get; set; } = default!;
    public DbSet<ClinkbitTransaction> ClinkbitTransactions { get; set; } = default!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserAccount>()
            .HasIndex(u => u.UsernameNormalized)
            .IsUnique();

        modelBuilder.Entity<EuchreGroup>()
            .HasOne(g => g.CreatedByUser)
            .WithMany()
            .HasForeignKey(g => g.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EuchreGroupEditor>()
            .HasIndex(e => new { e.EuchreGroupId, e.UserAccountId })
            .IsUnique();

        modelBuilder.Entity<EuchreGroupEditor>()
            .HasOne(e => e.EuchreGroup)
            .WithMany(g => g.Editors)
            .HasForeignKey(e => e.EuchreGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EuchreGroupEditor>()
            .HasOne(e => e.UserAccount)
            .WithMany()
            .HasForeignKey(e => e.UserAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EuchrePlayer>()
            .HasIndex(p => new { p.EuchreGroupId, p.Name })
            .IsUnique();

        modelBuilder.Entity<EuchrePlayer>()
            .HasOne(p => p.EuchreGroup)
            .WithMany(g => g.Players)
            .HasForeignKey(p => p.EuchreGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EuchreGame>()
            .HasOne(g => g.EuchreGroup)
            .WithMany(gr => gr.Games)
            .HasForeignKey(g => g.EuchreGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EuchreGame>()
            .HasOne(g => g.CreatedByUser)
            .WithMany()
            .HasForeignKey(g => g.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EuchreGameParticipant>()
            .HasOne(p => p.EuchreGame)
            .WithMany(g => g.Participants)
            .HasForeignKey(p => p.EuchreGameId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EuchreGameParticipant>()
            .HasOne(p => p.EuchrePlayer)
            .WithMany(pl => pl.GameParticipants)
            .HasForeignKey(p => p.EuchrePlayerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EuchreGameParticipant>()
            .HasIndex(p => new { p.EuchreGameId, p.EuchrePlayerId })
            .IsUnique();

        modelBuilder.Entity<ClinkbitTransaction>()
            .HasOne(t => t.UserAccount)
            .WithMany()
            .HasForeignKey(t => t.UserAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ClinkbitTransaction>()
            .HasIndex(t => new { t.UserAccountId, t.CreatedUtc });
    }
}
