using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JakeServer.Migrations
{
    /// <inheritdoc />
    public partial class AddClinkbitsCurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ClinkbitsBalance",
                table: "UserAccounts",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClinkbitsUpdatedUtc",
                table: "UserAccounts",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "ClinkbitTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserAccountId = table.Column<int>(type: "INTEGER", nullable: false),
                    Amount = table.Column<int>(type: "INTEGER", nullable: false),
                    BalanceAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    Reason = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinkbitTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinkbitTransactions_UserAccounts_UserAccountId",
                        column: x => x.UserAccountId,
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClinkbitTransactions_UserAccountId_CreatedUtc",
                table: "ClinkbitTransactions",
                columns: new[] { "UserAccountId", "CreatedUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClinkbitTransactions");

            migrationBuilder.DropColumn(
                name: "ClinkbitsBalance",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "ClinkbitsUpdatedUtc",
                table: "UserAccounts");
        }
    }
}
