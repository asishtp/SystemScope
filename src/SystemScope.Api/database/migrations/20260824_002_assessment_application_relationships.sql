/* Persist the documented relationships between applications in assessment scope.
   The dashboard reads these records; it does not maintain a separate graph. */
DECLARE @relationships TABLE
(
    SourceKey NVARCHAR(100) NOT NULL,
    TargetKey NVARCHAR(100) NOT NULL,
    RelationshipName NVARCHAR(255) NOT NULL,
    Purpose NVARCHAR(500) NOT NULL
);

INSERT INTO @relationships (SourceKey, TargetKey, RelationshipName, Purpose)
VALUES
    (N'gauges', N'hydstra', N'Gauges to Hydstra', N'Time-series gauge and ground-station observations.'),
    (N'wasp', N'hydstra', N'WASP to Hydstra', N'Surface-water sample information.'),
    (N'wfieldapp', N'gwdb', N'Field application to Groundwater', N'Groundwater sample metadata captured in the field.'),
    (N'bls', N'gwdb', N'Bore Location System to Groundwater', N'Bore-location and drilling records.');

INSERT INTO dbo.Integrations
(
    Id, CreatedAt, UpdatedAt, Archived, ProjectId, SystemId, Name, SourceSystem,
    Target, BusinessPurpose, Direction, InformationExchanged, State, InterfaceType,
    Method, Technology, Frequency, [Trigger], Volume, Authentication, Encryption,
    Transformation, ErrorHandling, RetryMechanism, Owner, Monitoring, Criticality,
    ReplacementImpact, EvidenceId, Validation
)
SELECT
    NEWID(), SYSUTCDATETIME(), SYSUTCDATETIME(), 0, sourceSystem.ProjectId,
    sourceSystem.Id, relationship.RelationshipName, sourceSystem.Name,
    targetSystem.Name, relationship.Purpose, N'Outbound', relationship.Purpose,
    0, N'Data', N'Unknown', N'', N'Unknown', N'', N'', N'Unknown', N'Unknown',
    N'', N'Unknown', N'Unknown', sourceSystem.BusinessOwner, N'Unknown', N'Moderate',
    N'', NULL, 2
FROM @relationships relationship
JOIN dbo.Systems sourceSystem
    ON sourceSystem.CatalogKey = relationship.SourceKey AND sourceSystem.Archived = 0
JOIN dbo.Systems targetSystem
    ON targetSystem.ProjectId = sourceSystem.ProjectId
    AND targetSystem.CatalogKey = relationship.TargetKey
    AND targetSystem.Archived = 0
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.Integrations existing
    WHERE existing.SystemId = sourceSystem.Id
      AND existing.Archived = 0
      AND (existing.Target = targetSystem.Name
        OR existing.Target = targetSystem.Acronym
        OR existing.Target = targetSystem.CatalogKey)
);
GO
