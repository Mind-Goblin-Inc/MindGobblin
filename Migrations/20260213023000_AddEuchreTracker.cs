using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JakeServer.Migrations
{
    /// <inheritdoc />
    public partial class AddEuchreTracker : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EuchreGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EuchreGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EuchreGroups_UserAccounts_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EuchreGames",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EuchreGroupId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "INTEGER", nullable: false),
                    PlayedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TeamAScore = table.Column<int>(type: "INTEGER", nullable: false),
                    TeamBScore = table.Column<int>(type: "INTEGER", nullable: false),
                    WinnerTeam = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EuchreGames", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EuchreGames_EuchreGroups_EuchreGroupId",
                        column: x => x.EuchreGroupId,
                        principalTable: "EuchreGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EuchreGames_UserAccounts_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EuchreGroupEditors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EuchreGroupId = table.Column<int>(type: "INTEGER", nullable: false),
                    UserAccountId = table.Column<int>(type: "INTEGER", nullable: false),
                    AddedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EuchreGroupEditors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EuchreGroupEditors_EuchreGroups_EuchreGroupId",
                        column: x => x.EuchreGroupId,
                        principalTable: "EuchreGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EuchreGroupEditors_UserAccounts_UserAccountId",
                        column: x => x.UserAccountId,
                        principalTable: "UserAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EuchrePlayers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EuchreGroupId = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EuchrePlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EuchrePlayers_EuchreGroups_EuchreGroupId",
                        column: x => x.EuchreGroupId,
                        principalTable: "EuchreGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EuchreGameParticipants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    EuchreGameId = table.Column<int>(type: "INTEGER", nullable: false),
                    EuchrePlayerId = table.Column<int>(type: "INTEGER", nullable: false),
                    Team = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EuchreGameParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EuchreGameParticipants_EuchreGames_EuchreGameId",
                        column: x => x.EuchreGameId,
                        principalTable: "EuchreGames",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EuchreGameParticipants_EuchrePlayers_EuchrePlayerId",
                        column: x => x.EuchrePlayerId,
                        principalTable: "EuchrePlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EuchreGameParticipants_EuchreGameId_EuchrePlayerId",
                table: "EuchreGameParticipants",
                columns: new[] { "EuchreGameId", "EuchrePlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EuchreGameParticipants_EuchrePlayerId",
                table: "EuchreGameParticipants",
                column: "EuchrePlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_EuchreGames_CreatedByUserId",
                table: "EuchreGames",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EuchreGames_EuchreGroupId",
                table: "EuchreGames",
                column: "EuchreGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_EuchreGroupEditors_EuchreGroupId_UserAccountId",
                table: "EuchreGroupEditors",
                columns: new[] { "EuchreGroupId", "UserAccountId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EuchreGroupEditors_UserAccountId",
                table: "EuchreGroupEditors",
                column: "UserAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_EuchreGroups_CreatedByUserId",
                table: "EuchreGroups",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EuchrePlayers_EuchreGroupId_Name",
                table: "EuchrePlayers",
                columns: new[] { "EuchreGroupId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EuchreGameParticipants");

            migrationBuilder.DropTable(
                name: "EuchreGroupEditors");

            migrationBuilder.DropTable(
                name: "EuchreGames");

            migrationBuilder.DropTable(
                name: "EuchrePlayers");

            migrationBuilder.DropTable(
                name: "EuchreGroups");
        }
    }
}
