record EchoRequest(string Message);
record ScoreRequest(string Username, int? Value);
record AuthRequest(string Username, string Password);
record EuchreCreateGroupRequest(string Name);
record EuchreAddEditorRequest(string Username);
record EuchreCreatePlayerRequest(string Name);
record EuchreGameUpsertRequest(int[] TeamAPlayerIds, int[] TeamBPlayerIds, int TeamAScore, int TeamBScore, string WinnerTeam, DateTimeOffset? PlayedAtUtc);
record EuchrePlayerStatDto(int PlayerId, string Name, int Wins, int Losses);
record ClinkbitSpendRequest(int Amount, string? Reason);
record ClinkbitGrantRequest(int Amount, string? Reason);
record ClinkbitGambleRequest(string Game, int Bet, string? Choice, int? ExactTotal, int? Chest, string? Color, string? Call, int? Pocket, int? SafePicks, decimal? CashoutMultiplier);

record Score
{
    public string Username { get; set; } = default!;
    public int Value { get; set; }
    public DateTimeOffset At { get; set; }
}

class EuchreDuoStatMutable
{
    public int PlayerAId { get; set; }
    public string PlayerAName { get; set; } = "";
    public int PlayerBId { get; set; }
    public string PlayerBName { get; set; } = "";
    public int Wins { get; set; }
    public int Losses { get; set; }
}
