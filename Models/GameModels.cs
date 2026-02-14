using System.ComponentModel.DataAnnotations;

public class TetrisScore
{
    public int Id { get; set; }
    public string Player { get; set; } = "";
    public int Points { get; set; }
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;
}

public class PongGameLobby
{
    [Key]
    public string LobbyId { get; set; } = Guid.NewGuid().ToString("N");
    public string? LobbyName { get; set; }
    public string? HostConnectionId { get; set; }
    public string? ChallengerConnectionId { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;

    public bool IsFull => !string.IsNullOrEmpty(HostConnectionId) && !string.IsNullOrEmpty(ChallengerConnectionId);
}

public class UserAccount
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string UsernameNormalized { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string PasswordSalt { get; set; } = "";
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public DateTime LastLoginUtc { get; set; } = DateTime.UtcNow;
    public int ClinkbitsBalance { get; set; } = 0;
    public DateTime ClinkbitsUpdatedUtc { get; set; } = DateTime.UtcNow;
}

public class ClinkbitTransaction
{
    public int Id { get; set; }
    public int UserAccountId { get; set; }
    public UserAccount UserAccount { get; set; } = default!;
    public int Amount { get; set; }
    public int BalanceAfter { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}

public class EuchreGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int CreatedByUserId { get; set; }
    public UserAccount CreatedByUser { get; set; } = default!;
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public List<EuchreGroupEditor> Editors { get; set; } = new();
    public List<EuchrePlayer> Players { get; set; } = new();
    public List<EuchreGame> Games { get; set; } = new();
}

public class EuchreGroupEditor
{
    public int Id { get; set; }
    public int EuchreGroupId { get; set; }
    public EuchreGroup EuchreGroup { get; set; } = default!;
    public int UserAccountId { get; set; }
    public UserAccount UserAccount { get; set; } = default!;
    public DateTime AddedUtc { get; set; } = DateTime.UtcNow;
}

public class EuchrePlayer
{
    public int Id { get; set; }
    public int EuchreGroupId { get; set; }
    public EuchreGroup EuchreGroup { get; set; } = default!;
    public string Name { get; set; } = "";
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public List<EuchreGameParticipant> GameParticipants { get; set; } = new();
}

public class EuchreGame
{
    public int Id { get; set; }
    public int EuchreGroupId { get; set; }
    public EuchreGroup EuchreGroup { get; set; } = default!;
    public int CreatedByUserId { get; set; }
    public UserAccount CreatedByUser { get; set; } = default!;
    public DateTime PlayedAtUtc { get; set; } = DateTime.UtcNow;
    public int TeamAScore { get; set; }
    public int TeamBScore { get; set; }
    public string WinnerTeam { get; set; } = "A";
    public List<EuchreGameParticipant> Participants { get; set; } = new();
}

public class EuchreGameParticipant
{
    public int Id { get; set; }
    public int EuchreGameId { get; set; }
    public EuchreGame EuchreGame { get; set; } = default!;
    public int EuchrePlayerId { get; set; }
    public EuchrePlayer EuchrePlayer { get; set; } = default!;
    public string Team { get; set; } = "A";
}
