using Microsoft.EntityFrameworkCore;

static class ClinkbitLedger
{
    public static async Task<(bool Ok, string? Error, int Balance)> ApplyAsync(
        MindGoblinDbContext db,
        int userId,
        int amountDelta,
        string reason)
    {
        var user = await db.UserAccounts.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return (false, "User not found.", 0);

        var newBalance = user.ClinkbitsBalance + amountDelta;
        if (newBalance < 0) return (false, "Insufficient clinkbits.", user.ClinkbitsBalance);

        user.ClinkbitsBalance = newBalance;
        user.ClinkbitsUpdatedUtc = DateTime.UtcNow;

        db.ClinkbitTransactions.Add(new ClinkbitTransaction
        {
            UserAccountId = userId,
            Amount = amountDelta,
            BalanceAfter = newBalance,
            Reason = reason,
            CreatedUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync();
        return (true, null, newBalance);
    }
}
