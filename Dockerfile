# Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy only csproj files first and restore dependencies
COPY *.csproj ./
RUN dotnet restore JakeServer.csproj

# Copy the rest of the source code
COPY . ./
RUN dotnet publish JakeServer.csproj -c Release -o /app --no-restore

# Run
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["dotnet", "JakeServer.dll"]
