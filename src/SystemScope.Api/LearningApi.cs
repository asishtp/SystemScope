using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace SystemScope.Api;

public static class LearningApi
{
    public static void MapLearning(this RouteGroupBuilder api)
    {
        api.MapGet("/systems/{systemId}/learning-dashboard", Dashboard);
        api.MapGet("/systems/{systemId}/learning-search", Search);
        api.MapGet("/systems/{systemId}/data-model", DataModel);
        api.MapGet("/systems/{systemId}/tables/{tableId}", Table);
        api.MapGet("/systems/{systemId}/glossary", Glossary);
        api.MapGet("/learning/courses/{courseId:guid}/lessons", CourseLessons);
        api.MapGet("/learning/lessons/{lessonId}", GetLesson);
        api.MapPut("/learning/lessons/{lessonId:guid}/progress", SaveProgress);
        api.MapPost("/learning/lessons/{lessonId:guid}/complete", CompleteLesson);
        api.MapPost("/learning/questions/{questionId:guid}/answer", AnswerQuestion);
        api.MapGet("/learning/bookmarks", ListBookmarks);
        api.MapPost("/learning/bookmarks", CreateBookmark);
        api.MapDelete("/learning/bookmarks/{bookmarkId:guid}", DeleteBookmark);
        api.MapGet("/learning/notes", ListNotes);
        api.MapPost("/learning/notes", CreateNote);
        api.MapPut("/learning/notes/{noteId:guid}", UpdateNote);
        api.MapDelete("/learning/notes/{noteId:guid}", DeleteNote);
        api.MapPost("/systems/{systemId}/learning-imports/validate", ValidateImport);
        api.MapPost("/systems/{systemId}/learning-imports", ExecuteImport);
        api.MapGet("/systems/{systemId}/learning-imports", ListImports);
        api.MapGet("/systems/{systemId}/learning-imports/{importId:guid}", GetImport);
        api.MapGet("/systems/{systemId}/learning-imports/{importId:guid}/errors", GetImportErrors);
    }

    static async Task<IResult> Dashboard(string systemId, AppDbContext db, ClaimsPrincipal user)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var course = await db.LearningCourses.FirstOrDefaultAsync(x => x.SystemId == system.Id && !x.Archived);
        if (course is null) return Results.Ok(EmptyDashboard(system));

        var lessons = await db.LearningLessons.Where(x => x.CourseId == course.Id && !x.Archived)
            .OrderBy(x => x.DisplayOrder).ToListAsync();
        var published = lessons.Where(x => x.Status == "Published").ToList();
        var visible = published.Count > 0 ? published : lessons;
        var userId = CurrentUser(user);
        var lessonIds = visible.Select(x => x.Id).ToList();
        var progress = await db.UserLessonProgress.Where(x => x.UserId == userId && lessonIds.Contains(x.LessonId)).ToListAsync();
        var progressByLesson = progress.ToDictionary(x => x.LessonId);
        var completed = progress.Count(x => x.Status == "Completed");
        var continueLesson = visible
            .Select(l => (Lesson: l, Progress: progressByLesson.GetValueOrDefault(l.Id)))
            .Where(x => x.Progress?.Status != "Completed")
            .OrderByDescending(x => x.Progress?.LastAccessedAtUtc)
            .ThenBy(x => x.Lesson.DisplayOrder)
            .Select(x => x.Lesson)
            .FirstOrDefault()
            ?? visible.LastOrDefault();

        var bookmarks = await db.LearningBookmarks.CountAsync(x => x.UserId == userId && x.SystemId == system.Id && !x.Archived);
        var notes = await db.LearningNotes.CountAsync(x => x.UserId == userId && x.SystemId == system.Id && !x.Archived);
        var tables = await db.LearningDataTables.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();
        var relationships = await db.LearningRelationships.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();

        return Results.Ok(new
        {
            system = new { system.Id, system.Name, system.CatalogKey, system.Acronym, projectName = "Water Monitoring Systems" },
            course = new { courseId = course.Id, course.Title, course.Description, lessonCount = visible.Count, course.EstimatedMinutes },
            progress = new
            {
                completedLessons = completed,
                totalLessons = visible.Count,
                percentage = visible.Count == 0 ? 0 : (int)Math.Round(completed * 100d / visible.Count),
            },
            continueLesson = continueLesson is null ? null : LessonCard(continueLesson, progressByLesson.GetValueOrDefault(continueLesson.Id)),
            lessons = visible.Select(l => LessonCard(l, progressByLesson.GetValueOrDefault(l.Id))),
            dataModel = new
            {
                tables = tables.Select(TableDto),
                relationships = relationships.Select(r => RelationshipDto(r, tables)),
            },
            quickAccess = new { bookmarks, notes },
            evidenceStatuses = EvidenceLegend(),
        });
    }

    static async Task<IResult> Search(string systemId, string? q, AppDbContext db)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var query = (q ?? "").Trim();
        if (query.Length < 2) return Results.Ok(Array.Empty<object>());
        var like = query.ToLowerInvariant();
        var course = await db.LearningCourses.FirstOrDefaultAsync(x => x.SystemId == system.Id && !x.Archived);
        var lessons = course is null
            ? []
            : await db.LearningLessons.Where(x => x.CourseId == course.Id && !x.Archived).ToListAsync();
        var glossary = await db.LearningGlossaryTerms.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();
        var tables = await db.LearningDataTables.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();
        var hits = new List<object>();
        foreach (var lesson in lessons.Where(x => Contains(x.Title, like) || Contains(x.Summary, like) || Contains(x.ContentMarkdown, like)))
            hits.Add(new { type = "Lesson", id = lesson.Id, key = lesson.LessonKey, title = lesson.Title, detail = lesson.Summary, evidenceStatus = lesson.EvidenceStatus });
        foreach (var term in glossary.Where(x => Contains(x.Term, like) || Contains(x.ShortDefinition, like)))
            hits.Add(new { type = "Glossary", id = term.Id, key = term.TermKey, title = term.Term, detail = term.ShortDefinition, evidenceStatus = term.EvidenceStatus });
        foreach (var table in tables.Where(x => Contains(x.Name, like) || Contains(x.TableKey, like) || Contains(x.Grain, like)))
            hits.Add(new { type = "Table", id = table.Id, key = table.TableKey, title = table.Name, detail = table.Grain ?? table.Domain, evidenceStatus = table.EvidenceStatus });
        return Results.Ok(hits.Take(25));
    }

    static async Task<IResult> DataModel(string systemId, AppDbContext db)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var tables = await db.LearningDataTables.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();
        var relationships = await db.LearningRelationships.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();
        return Results.Ok(new
        {
            tables = tables.Select(TableDto),
            relationships = relationships.Select(r => RelationshipDto(r, tables)),
            evidenceStatuses = EvidenceLegend(),
        });
    }

    static async Task<IResult> Table(string systemId, string tableId, AppDbContext db)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var tables = await db.LearningDataTables.Where(x => x.SystemId == system.Id && !x.Archived).ToListAsync();
        var table = Guid.TryParse(tableId, out var id)
            ? tables.FirstOrDefault(x => x.Id == id)
            : tables.FirstOrDefault(x => x.TableKey.Equals(tableId, StringComparison.OrdinalIgnoreCase));
        if (table is null) return Results.NotFound();
        var relationships = await db.LearningRelationships.Where(x => x.SystemId == system.Id && !x.Archived && (x.FromTableId == table.Id || x.ToTableId == table.Id)).ToListAsync();
        return Results.Ok(new
        {
            table = TableDto(table),
            relationships = relationships.Select(r => RelationshipDto(r, tables)),
        });
    }

    static async Task<IResult> Glossary(string systemId, AppDbContext db)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var terms = await db.LearningGlossaryTerms.Where(x => x.SystemId == system.Id && !x.Archived).OrderBy(x => x.Term).ToListAsync();
        var documents = await db.LearningDocuments.Where(x => x.SystemId == system.Id && !x.Archived).ToDictionaryAsync(x => x.Id);
        return Results.Ok(terms.Select(t => new
        {
            t.Id,
            t.TermKey,
            t.Term,
            t.ShortDefinition,
            t.DetailedDefinition,
            t.EvidenceStatus,
            source = t.SourceDocumentId is Guid docId && documents.TryGetValue(docId, out var doc)
                ? new { documentKey = doc.DocumentKey, title = doc.Title, page = t.SourcePage }
                : null,
        }));
    }

    static async Task<IResult> CourseLessons(Guid courseId, AppDbContext db, ClaimsPrincipal user)
    {
        var lessons = await db.LearningLessons.Where(x => x.CourseId == courseId && !x.Archived).OrderBy(x => x.DisplayOrder).ToListAsync();
        var userId = CurrentUser(user);
        var progress = await db.UserLessonProgress.Where(x => x.UserId == userId && lessons.Select(l => l.Id).Contains(x.LessonId)).ToListAsync();
        var map = progress.ToDictionary(x => x.LessonId);
        return Results.Ok(lessons.Select(l => LessonCard(l, map.GetValueOrDefault(l.Id))));
    }

    static async Task<IResult> GetLesson(string lessonId, AppDbContext db, ClaimsPrincipal user)
    {
        var lesson = await FindLesson(db, lessonId);
        if (lesson is null) return Results.NotFound();
        var userId = CurrentUser(user);
        var progress = await db.UserLessonProgress.FindAsync(userId, lesson.Id);
        if (progress is null)
        {
            progress = new UserLessonProgress
            {
                UserId = userId,
                LessonId = lesson.Id,
                Status = "InProgress",
                ProgressPercentage = 0,
                StartedAtUtc = DateTimeOffset.UtcNow,
                LastAccessedAtUtc = DateTimeOffset.UtcNow,
            };
            db.UserLessonProgress.Add(progress);
            await db.SaveChangesAsync();
        }
        else if (progress.Status != "Completed")
        {
            progress.Status = "InProgress";
            progress.LastAccessedAtUtc = DateTimeOffset.UtcNow;
            progress.StartedAtUtc ??= DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }
        else
        {
            progress.LastAccessedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync();
        }

        var sources = await db.LessonSources.Include(x => x.Document).Where(x => x.LessonId == lesson.Id && !x.Archived).ToListAsync();
        var questions = await db.LessonQuestions.Include(x => x.Options).Where(x => x.LessonId == lesson.Id && !x.Archived).OrderBy(x => x.DisplayOrder).ToListAsync();
        var courseLessons = await db.LearningLessons.Where(x => x.CourseId == lesson.CourseId && !x.Archived).OrderBy(x => x.DisplayOrder).Select(x => new { x.Id, x.LessonKey, x.Title, x.DisplayOrder }).ToListAsync();
        var index = courseLessons.FindIndex(x => x.Id == lesson.Id);
        var bookmark = await db.LearningBookmarks.FirstOrDefaultAsync(x => x.UserId == userId && x.LessonId == lesson.Id && !x.Archived);
        var notes = await db.LearningNotes.Where(x => x.UserId == userId && x.LessonId == lesson.Id && !x.Archived).OrderByDescending(x => x.UpdatedAt).ToListAsync();
        return Results.Ok(new
        {
            lesson.Id,
            lesson.LessonKey,
            lesson.Title,
            lesson.Summary,
            lesson.ContentMarkdown,
            objectives = lesson.Objectives,
            keyTakeaways = lesson.KeyTakeaways,
            verificationChecks = lesson.VerificationChecks,
            lesson.DurationMinutes,
            lesson.DisplayOrder,
            lesson.Status,
            lesson.EvidenceStatus,
            progress = ProgressDto(progress),
            sources = sources.Select(s => new
            {
                s.Id,
                documentKey = s.Document?.DocumentKey,
                title = s.Document?.Title,
                fileName = s.Document?.FileName,
                version = s.Document?.Version,
                s.PageFrom,
                s.PageTo,
                s.SectionName,
                s.EvidenceStatus,
            }),
            questions = questions.Select(q => new
            {
                q.Id,
                q.QuestionKey,
                q.QuestionText,
                q.Explanation,
                q.DisplayOrder,
                options = q.Options.OrderBy(o => o.DisplayOrder).Select(o => new { o.Id, o.OptionKey, o.OptionText, o.DisplayOrder }),
            }),
            navigation = new
            {
                previous = index > 0 ? courseLessons[index - 1] : null,
                next = index >= 0 && index < courseLessons.Count - 1 ? courseLessons[index + 1] : null,
            },
            bookmarked = bookmark is not null,
            bookmarkId = bookmark?.Id,
            notes = notes.Select(NoteDto),
        });
    }

    static async Task<IResult> SaveProgress(Guid lessonId, ProgressInput input, AppDbContext db, ClaimsPrincipal user)
    {
        var lesson = await db.LearningLessons.FindAsync(lessonId);
        if (lesson is null) return Results.NotFound();
        var userId = CurrentUser(user);
        var progress = await db.UserLessonProgress.FindAsync(userId, lessonId);
        if (progress is null)
        {
            progress = new UserLessonProgress { UserId = userId, LessonId = lessonId, StartedAtUtc = DateTimeOffset.UtcNow };
            db.UserLessonProgress.Add(progress);
        }
        if (progress.Status != "Completed")
            progress.Status = "InProgress";
        progress.ProgressPercentage = Math.Clamp(input.ProgressPercentage, 0, 100);
        progress.LastPosition = input.LastPosition;
        progress.LastAccessedAtUtc = DateTimeOffset.UtcNow;
        progress.StartedAtUtc ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(ProgressDto(progress));
    }

    static async Task<IResult> CompleteLesson(Guid lessonId, AppDbContext db, ClaimsPrincipal user)
    {
        var lesson = await db.LearningLessons.FindAsync(lessonId);
        if (lesson is null) return Results.NotFound();
        var userId = CurrentUser(user);
        var progress = await db.UserLessonProgress.FindAsync(userId, lessonId);
        if (progress is null)
        {
            progress = new UserLessonProgress { UserId = userId, LessonId = lessonId, StartedAtUtc = DateTimeOffset.UtcNow };
            db.UserLessonProgress.Add(progress);
        }
        progress.Status = "Completed";
        progress.ProgressPercentage = 100;
        progress.CompletedAtUtc ??= DateTimeOffset.UtcNow;
        progress.LastAccessedAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(ProgressDto(progress));
    }

    static async Task<IResult> AnswerQuestion(Guid questionId, AnswerInput input, AppDbContext db)
    {
        var option = await db.LessonQuestionOptions.FirstOrDefaultAsync(x => x.Id == input.OptionId && x.QuestionId == questionId && !x.Archived);
        if (option is null) return Results.NotFound();
        var question = await db.LessonQuestions.FindAsync(questionId);
        var correct = await db.LessonQuestionOptions.FirstOrDefaultAsync(x => x.QuestionId == questionId && x.IsCorrect);
        return Results.Ok(new { correct = option.IsCorrect, explanation = question?.Explanation, correctOptionKey = correct?.OptionKey });
    }

    static async Task<IResult> ListBookmarks(string? systemId, AppDbContext db, ClaimsPrincipal user)
    {
        var userId = CurrentUser(user);
        var q = db.LearningBookmarks.Where(x => x.UserId == userId && !x.Archived);
        if (!string.IsNullOrWhiteSpace(systemId))
        {
            var system = await ResolveSystem(db, systemId);
            if (system is null) return Results.NotFound();
            q = q.Where(x => x.SystemId == system.Id);
        }
        var rows = await q.OrderByDescending(x => x.CreatedAt).ToListAsync();
        return Results.Ok(rows.Select(b => new { b.Id, b.LessonId, b.EntityType, b.EntityId, b.Label, b.CreatedAt }));
    }

    static async Task<IResult> CreateBookmark(BookmarkInput input, AppDbContext db, ClaimsPrincipal user)
    {
        var system = await ResolveSystem(db, input.SystemId);
        if (system is null) return Results.NotFound();
        var userId = CurrentUser(user);
        var existing = await db.LearningBookmarks.FirstOrDefaultAsync(x =>
            x.UserId == userId && x.SystemId == system.Id && x.LessonId == input.LessonId && x.EntityType == input.EntityType && x.EntityId == input.EntityId && !x.Archived);
        if (existing is not null) return Results.Ok(new { existing.Id, existing.LessonId, existing.EntityType, existing.EntityId, existing.Label, existing.CreatedAt });
        var bookmark = new LearningBookmark
        {
            UserId = userId,
            SystemId = system.Id,
            LessonId = input.LessonId,
            EntityType = input.EntityType,
            EntityId = input.EntityId,
            Label = input.Label,
        };
        db.LearningBookmarks.Add(bookmark);
        await db.SaveChangesAsync();
        return Results.Created($"/api/learning/bookmarks/{bookmark.Id}", new { bookmark.Id, bookmark.LessonId, bookmark.EntityType, bookmark.EntityId, bookmark.Label, bookmark.CreatedAt });
    }

    static async Task<IResult> DeleteBookmark(Guid bookmarkId, AppDbContext db, ClaimsPrincipal user)
    {
        var bookmark = await db.LearningBookmarks.FindAsync(bookmarkId);
        if (bookmark is null || bookmark.UserId != CurrentUser(user)) return Results.NotFound();
        bookmark.Archived = true;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    static async Task<IResult> ListNotes(string? systemId, AppDbContext db, ClaimsPrincipal user)
    {
        var userId = CurrentUser(user);
        var q = db.LearningNotes.Where(x => x.UserId == userId && !x.Archived);
        if (!string.IsNullOrWhiteSpace(systemId))
        {
            var system = await ResolveSystem(db, systemId);
            if (system is null) return Results.NotFound();
            q = q.Where(x => x.SystemId == system.Id);
        }
        var rows = await q.OrderByDescending(x => x.UpdatedAt).ToListAsync();
        return Results.Ok(rows.Select(NoteDto));
    }

    static async Task<IResult> CreateNote(NoteInput input, AppDbContext db, ClaimsPrincipal user)
    {
        var system = await ResolveSystem(db, input.SystemId);
        if (system is null) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(input.NoteText)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["noteText"] = ["A note is required."] });
        var note = new LearningNote
        {
            UserId = CurrentUser(user),
            SystemId = system.Id,
            LessonId = input.LessonId,
            EntityType = input.EntityType,
            EntityId = input.EntityId,
            NoteText = input.NoteText.Trim(),
        };
        db.LearningNotes.Add(note);
        await db.SaveChangesAsync();
        return Results.Created($"/api/learning/notes/{note.Id}", NoteDto(note));
    }

    static async Task<IResult> UpdateNote(Guid noteId, NoteInput input, AppDbContext db, ClaimsPrincipal user)
    {
        var note = await db.LearningNotes.FindAsync(noteId);
        if (note is null || note.UserId != CurrentUser(user) || note.Archived) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(input.NoteText)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["noteText"] = ["A note is required."] });
        note.NoteText = input.NoteText.Trim();
        await db.SaveChangesAsync();
        return Results.Ok(NoteDto(note));
    }

    static async Task<IResult> DeleteNote(Guid noteId, AppDbContext db, ClaimsPrincipal user)
    {
        var note = await db.LearningNotes.FindAsync(noteId);
        if (note is null || note.UserId != CurrentUser(user)) return Results.NotFound();
        note.Archived = true;
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    static async Task<IResult> ValidateImport(string systemId, HttpRequest request, AppDbContext db)
    {
        var loaded = await ReadPackage(request);
        if (loaded.Error is not null) return loaded.Error;
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var existing = await LearningImportService.LoadExisting(db, system.Id, loaded.Package!.Course.CourseKey);
        var preview = LearningImportService.Validate(loaded.Package, system, existing, publishLessons: false);
        return Results.Ok(preview);
    }

    static async Task<IResult> ExecuteImport(string systemId, HttpRequest request, AppDbContext db, ClaimsPrincipal user)
    {
        var loaded = await ReadPackage(request);
        if (loaded.Error is not null) return loaded.Error;
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var existing = await LearningImportService.LoadExisting(db, system.Id, loaded.Package!.Course.CourseKey);
        var publish = loaded.Package.ImportSettings.PublishLessons;
        var preview = LearningImportService.Validate(loaded.Package, system, existing, publish);
        if (!preview.IsValid) return Results.BadRequest(preview);
        var idempotency = request.Headers["Idempotency-Key"].FirstOrDefault();
        var imported = await LearningImportService.Apply(db, system, loaded.Package, preview, new LearningImportOptions(publish, CurrentUser(user), loaded.FileName, idempotency), loaded.Json!);
        return Results.Ok(new
        {
            importId = imported.Id,
            imported.PackageId,
            imported.Status,
            imported.CreatedCount,
            imported.UpdatedCount,
            imported.UnchangedCount,
            imported.WarningCount,
            imported.ErrorCount,
            items = imported.Items.Select(i => new { i.EntityType, i.StableKey, i.Operation, i.Status, i.Message }),
        });
    }

    static async Task<IResult> ListImports(string systemId, AppDbContext db)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var rows = await db.LearningImports.Where(x => x.SystemId == system.Id).OrderByDescending(x => x.RequestedAtUtc).Take(50).ToListAsync();
        return Results.Ok(rows.Select(x => new { x.Id, x.PackageId, x.FileName, x.Status, x.CreatedCount, x.UpdatedCount, x.WarningCount, x.ErrorCount, x.RequestedBy, x.RequestedAtUtc, x.CompletedAtUtc }));
    }

    static async Task<IResult> GetImport(string systemId, Guid importId, AppDbContext db)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var imported = await db.LearningImports.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == importId && x.SystemId == system.Id);
        return imported is null ? Results.NotFound() : Results.Ok(imported);
    }

    static async Task<IResult> GetImportErrors(string systemId, Guid importId, AppDbContext db)
    {
        var system = await ResolveSystem(db, systemId);
        if (system is null) return Results.NotFound();
        var items = await db.LearningImportItems.Where(x => x.ImportId == importId && x.Status == "Error").ToListAsync();
        return Results.Ok(items);
    }

    static async Task<(LearningPackage? Package, string? Json, string FileName, IResult? Error)> ReadPackage(HttpRequest request)
    {
        if (!request.HasFormContentType)
            return (null, null, "", Results.BadRequest(new { isValid = false, errors = new[] { new { code = "MISSING_FILE", jsonPath = "$", message = "Upload a JSON package." } } }));
        var form = await request.ReadFormAsync();
        var file = form.Files["package"] ?? form.Files["file"] ?? form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
            return (null, null, "", Results.BadRequest(new { isValid = false, errors = new[] { new { code = "MISSING_FILE", jsonPath = "$", message = "Upload a JSON package." } } }));
        if (file.Length > LearningImportService.MaxPackageBytes)
            return (null, null, file.FileName, Results.BadRequest(new { isValid = false, errors = new[] { new { code = "FILE_TOO_LARGE", jsonPath = "$", message = "Package exceeds the 10 MB limit." } } }));
        using var reader = new StreamReader(file.OpenReadStream());
        var json = await reader.ReadToEndAsync();
        try
        {
            var package = LearningImportService.Parse(json);
            return (package, json, file.FileName, null);
        }
        catch (JsonException ex)
        {
            return (null, json, file.FileName, Results.BadRequest(new { isValid = false, errors = new[] { new { code = "INVALID_JSON", jsonPath = "$", message = ex.Message } } }));
        }
    }

    public static async Task<AssessedSystem?> ResolveSystem(AppDbContext db, string systemId)
    {
        if (Guid.TryParse(systemId, out var id))
            return await db.Systems.FirstOrDefaultAsync(x => x.Id == id && !x.Archived);
        return await db.Systems.FirstOrDefaultAsync(x => x.CatalogKey == systemId.ToLowerInvariant() && !x.Archived);
    }

    static async Task<LearningLesson?> FindLesson(AppDbContext db, string lessonId)
    {
        if (Guid.TryParse(lessonId, out var id))
            return await db.LearningLessons.FirstOrDefaultAsync(x => x.Id == id && !x.Archived);
        return await db.LearningLessons.FirstOrDefaultAsync(x => x.LessonKey == lessonId && !x.Archived);
    }

    static string CurrentUser(ClaimsPrincipal user) => AppIdentity.UserId(user) ?? user.Identity?.Name ?? "local-user";

    static bool Contains(string? value, string like) => (value ?? "").ToLowerInvariant().Contains(like);

    static object LessonCard(LearningLesson lesson, UserLessonProgress? progress) => new
    {
        lessonId = lesson.Id,
        lesson.LessonKey,
        lesson.Title,
        lesson.Summary,
        lesson.DurationMinutes,
        lesson.DisplayOrder,
        lesson.EvidenceStatus,
        status = progress?.Status ?? "NotStarted",
        progressPercentage = progress?.ProgressPercentage ?? 0,
    };

    static object ProgressDto(UserLessonProgress progress) => new
    {
        progress.Status,
        progress.ProgressPercentage,
        progress.StartedAtUtc,
        progress.LastAccessedAtUtc,
        progress.CompletedAtUtc,
        progress.LastPosition,
    };

    static object TableDto(LearningDataTable table) => new
    {
        table.Id,
        table.TableKey,
        table.Name,
        table.PhysicalName,
        table.Description,
        table.Domain,
        table.Grain,
        candidateKey = table.CandidateKey,
        table.EvidenceStatus,
    };

    static object RelationshipDto(LearningRelationship relationship, List<LearningDataTable> tables)
    {
        var from = tables.FirstOrDefault(x => x.Id == relationship.FromTableId);
        var to = tables.FirstOrDefault(x => x.Id == relationship.ToTableId);
        return new
        {
            relationship.Id,
            relationship.RelationshipKey,
            fromTableKey = from?.TableKey,
            fromTableName = from?.Name,
            toTableKey = to?.TableKey,
            toTableName = to?.Name,
            fields = JsonSerializer.Deserialize<List<LearningPackageRelationshipField>>(relationship.FieldsJson) ?? [],
            relationship.Cardinality,
            relationship.EvidenceStatus,
        };
    }

    static object NoteDto(LearningNote note) => new { note.Id, note.LessonId, note.EntityType, note.EntityId, note.NoteText, note.CreatedAt, note.UpdatedAt };

    static object[] EvidenceLegend() =>
    [
        new { key = "DOCUMENTED", name = "Documented", description = "Explicitly stated in an approved source document.", colour = "#2E7D32" },
        new { key = "INFERRED", name = "Inferred", description = "Derived from table structure, repeated fields or technical analysis.", colour = "#ED6C02" },
        new { key = "SCHEMA_VERIFIED", name = "Schema verified", description = "Confirmed from Oracle DDL, metadata or source code.", colour = "#1565C0" },
    ];

    static object EmptyDashboard(AssessedSystem system) => new
    {
        system = new { system.Id, system.Name, system.CatalogKey, system.Acronym, projectName = "Water Monitoring Systems" },
        course = new { courseId = Guid.Empty, title = "Learn GWDB", description = "No learning package has been imported yet.", lessonCount = 0, estimatedMinutes = 0 },
        progress = new { completedLessons = 0, totalLessons = 0, percentage = 0 },
        continueLesson = (object?)null,
        lessons = Array.Empty<object>(),
        dataModel = new { tables = Array.Empty<object>(), relationships = Array.Empty<object>() },
        quickAccess = new { bookmarks = 0, notes = 0 },
        evidenceStatuses = EvidenceLegend(),
    };
}

public record AnswerInput(Guid OptionId);
public record ProgressInput(int ProgressPercentage, string? LastPosition);
public record BookmarkInput(string SystemId, Guid? LessonId, string? EntityType, string? EntityId, string? Label);
public record NoteInput(string SystemId, Guid? LessonId, string? EntityType, string? EntityId, string NoteText);
