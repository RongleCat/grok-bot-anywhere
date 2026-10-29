# Grok Bot 客户端静态接口目录

来源：本机 0.70.2，app.asar SHA256 8dd7b6c4a58439d626a9a7b3766982b7c725db2bc1f6ff68a29fc1ec62ca4cf7。

此目录是bundle中的服务/方法声明，不是全部请求的抓包记录。实测范围见 grok-bot-client-api.md 和脱敏报告；其他方法不宣称已经调用或可由普通账号访问。引用数按 main-app.cjs 中 .clientMethod( 的文本匹配计数，同名方法跨服务会重复计数，不能当作网络调用次数。字段来自发布包的schema元数据，接口版本更新后应重新提取。

## Connect RPC 服务

### aiserver.v1.AgentStoreService

| Method | 类型 | Request | Response | 静态引用数 |
| --- | --- | --- | --- | --- |
| ListAgentStores | Unary | ListAgentStoresRequest | ListAgentStoresResponse | 1 |
| ListAgentStoreEntries | Unary | ListAgentStoreEntriesRequest | ListAgentStoreEntriesResponse | 0 |
| ReadAgentStoreFile | Unary | ReadAgentStoreFileRequest | ReadAgentStoreFileResponse | 2 |
| WriteAgentStoreDocument | Unary | WriteAgentStoreDocumentRequest | WriteAgentStoreDocumentResponse | 1 |
| SetAgentStoreDocumentVisibility | Unary | SetAgentStoreDocumentVisibilityRequest | SetAgentStoreDocumentVisibilityResponse | 1 |
| MintAgentStoreToken | Unary | MintAgentStoreTokenRequest | MintAgentStoreTokenResponse | 0 |
| ListAgentStoreFiles | Unary | ListAgentStoreFilesRequest | ListAgentStoreFilesResponse | 0 |
| ListAgentStoreDirectory | Unary | ListAgentStoreDirectoryRequest | ListAgentStoreDirectoryResponse | 2 |
| CheckAgentStoreVersions | Unary | CheckAgentStoreVersionsRequest | CheckAgentStoreVersionsResponse | 0 |
| PresignAgentStoreReads | Unary | PresignAgentStoreReadsRequest | PresignAgentStoreReadsResponse | 1 |
| PresignAgentStoreWrites | Unary | PresignAgentStoreWritesRequest | PresignAgentStoreWritesResponse | 0 |
| CompleteAgentStoreMultipartWrites | Unary | CompleteAgentStoreMultipartWritesRequest | CompleteAgentStoreMultipartWritesResponse | 0 |
| AbortAgentStoreMultipartWrites | Unary | AbortAgentStoreMultipartWritesRequest | AbortAgentStoreMultipartWritesResponse | 0 |
| AcquireAgentStoreFileLock | Unary | AcquireAgentStoreFileLockRequest | AcquireAgentStoreFileLockResponse | 0 |
| RenewAgentStoreFileLock | Unary | RenewAgentStoreFileLockRequest | RenewAgentStoreFileLockResponse | 0 |
| ReleaseAgentStoreFileLock | Unary | ReleaseAgentStoreFileLockRequest | ReleaseAgentStoreFileLockResponse | 0 |
| GetAgentStoreFileLock | Unary | GetAgentStoreFileLockRequest | GetAgentStoreFileLockResponse | 0 |
| DeleteAgentStoreFiles | Unary | DeleteAgentStoreFilesRequest | DeleteAgentStoreFilesResponse | 0 |
| RmdirAgentStore | Unary | RmdirAgentStoreRequest | RmdirAgentStoreResponse | 0 |
| UndeleteAgentStoreFiles | Unary | UndeleteAgentStoreFilesRequest | UndeleteAgentStoreFilesResponse | 0 |
| ListAgentStoreTombstones | Unary | ListAgentStoreTombstonesRequest | ListAgentStoreTombstonesResponse | 0 |
| ShareAgentStore | Unary | ShareAgentStoreRequest | ShareAgentStoreResponse | 0 |
| UnshareAgentStore | Unary | UnshareAgentStoreRequest | UnshareAgentStoreResponse | 0 |
| ListSharedAgentStores | Unary | ListSharedAgentStoresRequest | ListSharedAgentStoresResponse | 0 |

### aiserver.v1.AiService

| Method | 类型 | Request | Response | 静态引用数 |
| --- | --- | --- | --- | --- |
| AvailableModels | Unary | AvailableModelsRequest | AvailableModelsResponse | 0 |
| RunGenerateImage | Unary | RunGenerateImageRequest | RunGenerateImageResponse | 1 |
| NameTab | Unary | NameTabRequest | NameTabResponse | 0 |
| ReportSandProcessMetrics | Unary | ReportSandProcessMetricsRequest | ReportSandProcessMetricsResponse | 1 |
| ReportClientNumericMetrics | Unary | ReportClientNumericMetricsRequest | ReportClientNumericMetricsResponse | 1 |
| StreamStt | BiDiStreaming | SttClientMessage | SttServerMessage | 0 |
| TranscribeAudio | Unary | TranscribeAudioRequest | TranscribeAudioResponse | 1 |
| TextToSpeech | Unary | TextToSpeechRequest | TextToSpeechResponse | 1 |

### aiserver.v1.BackgroundComposerService

| Method | 类型 | Request | Response | 静态引用数 |
| --- | --- | --- | --- | --- |
| GetBackgroundComposerInfo | Unary | GetBackgroundComposerInfoRequest | GetBackgroundComposerInfoResponse | 2 |
| GetOptimizedDiffDetails | Unary | GetOptimizedDiffDetailsRequest | GetOptimizedDiffDetailsResponse | 1 |
| ListWorkersForManager | Unary | ListWorkersForManagerRequest | ListWorkersForManagerResponse | 1 |
| GetTurnSummaryBackgroundComposer | Unary | GetTurnSummaryBackgroundComposerRequest | GetTurnSummaryBackgroundComposerResponse | 1 |
| ListBackgroundComposerArtifacts | Unary | ListBackgroundComposerArtifactsRequest | ListBackgroundComposerArtifactsResponse | 1 |
| GetBackgroundComposerUserSettings | Unary | GetBackgroundComposerUserSettingsRequest | GetBackgroundComposerUserSettingsResponse | 1 |
| GetPullRequestMergeStatus | Unary | GetPullRequestMergeStatusRequest | GetPullRequestMergeStatusResponse | 3 |

### aiserver.v1.DashboardService

| Method | 类型 | Request | Response | 静态引用数 |
| --- | --- | --- | --- | --- |
| GetTeams | Unary | GetTeamsRequest | GetTeamsResponse | 2 |
| GetMe | Unary | GetMeRequest | GetMeResponse | 5 |
| GetUnifyCta | Unary | GetUnifyCtaRequest | GetUnifyCtaResponse | 2 |
| GetTeamGroups | Unary | GetTeamGroupsRequest | GetTeamGroupsResponse | 1 |
| GetTeamPrepaidBilling | Unary | GetTeamPrepaidBillingRequest | GetTeamPrepaidBillingResponse | 1 |
| SetTeamPrepaidAutoTopUp | Unary | SetTeamPrepaidAutoTopUpRequest | SetTeamPrepaidAutoTopUpResponse | 1 |
| GetUserPrepaidBilling | Unary | GetUserPrepaidBillingRequest | GetUserPrepaidBillingResponse | 1 |
| SetUserPrepaidAutoTopUp | Unary | SetUserPrepaidAutoTopUpRequest | SetUserPrepaidAutoTopUpResponse | 1 |
| GetTeamMembers | Unary | GetTeamMembersRequest | GetTeamMembersResponse | 2 |
| SendTeamInvite | Unary | SendTeamInviteRequest | SendTeamInviteResponse | 1 |
| GetTeamInviteLink | Unary | GetTeamInviteLinkRequest | GetTeamInviteLinkResponse | 2 |
| PrepareGithubConnectFlow | Unary | PrepareGithubConnectFlowRequest | PrepareGithubConnectFlowResponse | 1 |
| CompleteGithubConnectFlow | Unary | CompleteGithubConnectFlowRequest | CompleteGithubConnectFlowResponse | 1 |
| DisconnectGithub | Unary | DisconnectGithubRequest | DisconnectGithubResponse | 1 |
| GetHardLimit | Unary | GetHardLimitRequest | GetHardLimitResponse | 2 |
| SetHardLimit | Unary | SetHardLimitRequest | SetHardLimitResponse | 2 |
| GetDailySpendByCategory | Unary | GetDailySpendByCategoryRequest | GetDailySpendByCategoryResponse | 6 |
| GetMcpConfig | Unary | GetMcpConfigRequest | GetMcpConfigResponse | 2 |
| GetAvailableMcpServers | Unary | GetAvailableMcpServersRequest | GetAvailableMcpServersResponse | 4 |
| SetMcpConfig | Unary | SetMcpConfigRequest | SetMcpConfigResponse | 1 |
| ListSandMcpTools | Unary | ListSandMcpToolsRequest | ListSandMcpToolsResponse | 1 |
| ExecuteSandMcpTool | Unary | ExecuteSandMcpToolRequest | ExecuteSandMcpToolResponse | 1 |
| ReadSandMcpResource | Unary | ReadSandMcpResourceRequest | ReadSandMcpResourceResponse | 1 |
| DeleteMcpOAuthToken | Unary | DeleteMcpOAuthTokenRequest | DeleteMcpOAuthTokenResponse | 1 |
| ValidateMcpOAuthTokens | Unary | ValidateMcpOAuthTokensRequest | ValidateMcpOAuthTokensResponse | 1 |
| CheckHttpMcpStatus | Unary | CheckHttpMcpStatusRequest | CheckHttpMcpStatusResponse | 2 |
| RenameMcpOAuthAccount | Unary | RenameMcpOAuthAccountRequest | RenameMcpOAuthAccountResponse | 1 |
| DeleteMcpOAuthAccount | Unary | DeleteMcpOAuthAccountRequest | DeleteMcpOAuthAccountResponse | 1 |
| CompleteMcpOAuth | Unary | CompleteMcpOAuthRequest | CompleteMcpOAuthResponse | 2 |
| GetPluginMcpConfig | Unary | GetPluginMcpConfigRequest | GetPluginMcpConfigResponse | 0 |
| GetTeamAdminSettingsOrEmptyIfNotInTeam | Unary | GetTeamAdminSettingsRequest | GetTeamAdminSettingsResponse | 1 |
| GetXaiCommerceBearerToken | Unary | GetXaiCommerceBearerTokenRequest | GetXaiCommerceBearerTokenResponse | 1 |
| GetCurrentPeriodUsage | Unary | GetCurrentPeriodUsageRequest | GetCurrentPeriodUsageResponse | 2 |
| GetSandUsageStatus | Unary | GetSandUsageStatusRequest | GetSandUsageStatusResponse | 2 |
| GetSandTrialClaimStatus | Unary | GetSandTrialClaimStatusRequest | GetSandTrialClaimStatusResponse | 1 |
| CancelSandTrial | Unary | CancelSandTrialRequest | CancelSandTrialResponse | 1 |
| GetSandAccessStatus | Unary | GetSandAccessStatusRequest | GetSandAccessStatusResponse | 1 |
| RegisterSandMachine | Unary | RegisterSandMachineRequest | RegisterSandMachineResponse | 1 |
| ListSandMachines | Unary | ListSandMachinesRequest | ListSandMachinesResponse | 1 |
| UpdateSandMachineLabel | Unary | UpdateSandMachineLabelRequest | UpdateSandMachineLabelResponse | 1 |
| UpdateSandMachineLocalToolPermission | Unary | UpdateSandMachineLocalToolPermissionRequest | UpdateSandMachineLocalToolPermissionResponse | 1 |
| GetSandMachineMessagesEnabled | Unary | GetSandMachineMessagesEnabledRequest | GetSandMachineMessagesEnabledResponse | 1 |
| UpdateSandMachineMessagesEnabled | Unary | UpdateSandMachineMessagesEnabledRequest | UpdateSandMachineMessagesEnabledResponse | 1 |
| RemoveSandMachine | Unary | RemoveSandMachineRequest | RemoveSandMachineResponse | 1 |
| GetMonthlyBillingCycle | Unary | GetMonthlyBillingCycleRequest | GetMonthlyBillingCycleResponse | 2 |
| GetGithubRepoAccessStatus | Unary | GetGithubRepoAccessStatusRequest | GetGithubRepoAccessStatusResponse | 1 |
| GetSlackInstallUrl | Unary | GetSlackInstallUrlRequest | GetSlackInstallUrlResponse | 1 |
| GetAggregatedUsageEvents | Unary | GetAggregatedUsageEventsRequest | GetAggregatedUsageEventsResponse | 2 |
| GetUserPrivacyMode | Unary | GetUserPrivacyModeRequest | GetUserPrivacyModeResponse | 2 |
| ListUserCanvases | Unary | ListUserCanvasesRequest | ListUserCanvasesResponse | 2 |
| GetCanvasMetadata | Unary | GetCanvasMetadataRequest | GetCanvasMetadataResponse | 2 |
| GetCanvasPayload | Unary | GetCanvasPayloadRequest | GetCanvasPayloadResponse | 1 |
| SetCanvasVisibility | Unary | SetCanvasVisibilityRequest | SetCanvasVisibilityResponse | 1 |
| SetPageAddress | Unary | SetPageAddressRequest | SetPageAddressResponse | 2 |
| RenameCanvas | Unary | RenameCanvasRequest | RenameCanvasResponse | 1 |
| UpdateUserName | Unary | UpdateUserNameRequest | UpdateUserNameResponse | 1 |
| UploadUserProfilePicture | Unary | UploadUserProfilePictureRequest | UploadUserProfilePictureResponse | 1 |
| CreateAutomationWebhookApiKey | Unary | CreateAutomationWebhookApiKeyRequest | CreateAutomationWebhookApiKeyResponse | 1 |
| GetSlackUserSettings | Unary | GetSlackUserSettingsRequest | GetSlackUserSettingsResponse | 1 |
| UnlinkSlackAccess | Unary | UnlinkSlackAccessRequest | UnlinkSlackAccessResponse | 1 |
| ClientAction | Unary | ClientActionRequest | ClientActionResponse | 1 |
| ListMarketplacePlugins | Unary | ListMarketplacePluginsRequest | ListMarketplacePluginsResponse | 2 |
| InstallUserPlugin | Unary | InstallUserPluginRequest | InstallUserPluginResponse | 2 |
| UpdateUserPluginInstall | Unary | UpdateUserPluginInstallRequest | UpdateUserPluginInstallResponse | 1 |
| UninstallUserPlugin | Unary | UninstallUserPluginRequest | UninstallUserPluginResponse | 1 |
| GetTeamPluginPopularity | Unary | GetTeamPluginPopularityRequest | GetTeamPluginPopularityResponse | 1 |
| GetEffectiveUserPlugins | Unary | GetEffectiveUserPluginsRequest | GetEffectiveUserPluginsResponse | 1 |
| ListMarketplaces | Unary | ListMarketplacesRequest | ListMarketplacesResponse | 1 |
| GetManagedSkills | Unary | GetManagedSkillsRequest | GetManagedSkillsResponse | 0 |
| ListFinancialConnections | Unary | ListFinancialConnectionsRequest | ListFinancialConnectionsResponse | 1 |
| ListFinancialAccounts | Unary | ListFinancialAccountsRequest | ListFinancialAccountsResponse | 1 |
| DeleteFinancialConnection | Unary | DeleteFinancialConnectionRequest | DeleteFinancialConnectionResponse | 1 |
| StartFinancialLink | Unary | StartFinancialLinkRequest | StartFinancialLinkResponse | 1 |

### aiserver.v1.AnalyticsService

| Method | 类型 | Request | Response | 静态引用数 |
| --- | --- | --- | --- | --- |
| TrackEvents | Unary | TrackEventsRequest | TrackEventsResponse | 1 |
| Batch | Unary | BatchRequest | BatchResponse | 0 |
| BootstrapStatsig | Unary | BootstrapStatsigRequest | BootstrapStatsigResponse | 0 |
| GetFirstWindowStatsigDecision | Unary | GetFirstWindowStatsigDecisionRequest | GetFirstWindowStatsigDecisionResponse | 0 |
| SubmitLogs | Unary | SubmitLogsRequest | SubmitLogsResponse | 3 |
| IngestConversation | Unary | IngestConversationRequest | IngestConversationResponse | 0 |
| UploadIssueTrace | Unary | UploadIssueTraceRequest | UploadIssueTraceResponse | 0 |
| DownloadIssueTraces | Unary | DownloadIssueTracesRequest | DownloadIssueTracesResponse | 0 |

### aiserver.v1.GrokBotService

| Method | 类型 | Request | Response | 静态引用数 |
| --- | --- | --- | --- | --- |
| EnsureSandBox | Unary | EnsureSandBoxRequest | EnsureSandBoxResponse | 1 |
| EnsureSandBoxWindow | Unary | EnsureSandBoxWindowRequest | EnsureSandBoxResponse | 0 |
| RecreateSandBox | Unary | RecreateSandBoxRequest | RecreateSandBoxResponse | 1 |
| ForceRecreateSandBox | Unary | ForceRecreateSandBoxRequest | RecreateSandBoxResponse | 1 |
| AdminRecreateSandBox | Unary | AdminRecreateSandBoxRequest | RecreateSandBoxResponse | 0 |
| AdminForceRecreateSandBox | Unary | AdminForceRecreateSandBoxRequest | RecreateSandBoxResponse | 0 |
| AdminBreakGlassDeleteSandBoxPod | Unary | AdminBreakGlassDeleteSandBoxPodRequest | AdminBreakGlassDeleteSandBoxPodResponse | 0 |
| PresignSandBoxStoreWrites | Unary | PresignSandBoxStoreWritesRequest | PresignSandBoxStoreWritesResponse | 0 |
| CompleteSandBoxStoreMultipartWrites | Unary | CompleteSandBoxStoreMultipartWritesRequest | CompleteSandBoxStoreMultipartWritesResponse | 0 |
| CommitSandBoxStoreManifest | Unary | CommitSandBoxStoreManifestRequest | CommitSandBoxStoreManifestResponse | 0 |
| AbortSandBoxStoreMultipartWrites | Unary | AbortSandBoxStoreMultipartWritesRequest | AbortSandBoxStoreMultipartWritesResponse | 0 |
| PresignSandBoxStoreReads | Unary | PresignSandBoxStoreReadsRequest | PresignSandBoxStoreReadsResponse | 1 |
| StatSandBoxStoreObject | Unary | StatSandBoxStoreObjectRequest | StatSandBoxStoreObjectResponse | 0 |
| ListSandBoxStoreObjects | Unary | ListSandBoxStoreObjectsRequest | ListSandBoxStoreObjectsResponse | 0 |
| AdminGetSandBoxStoreStatus | Unary | AdminSandBoxStoreStatusRequest | AdminSandBoxStoreStatusResponse | 0 |
| AdminUpdateSandBoxHost | Unary | AdminUpdateSandBoxHostRequest | AdminUpdateSandBoxHostResponse | 0 |
| AdminGetSandBoxHostStatus | Unary | AdminSandBoxHostStatusRequest | AdminSandBoxHostStatusResponse | 0 |
| AdminSnapshotSandBoxStore | Unary | AdminSnapshotSandBoxStoreRequest | AdminSnapshotSandBoxStoreResponse | 0 |
| AdminListSandBoxStoreManifestVersions | Unary | AdminListSandBoxStoreManifestVersionsRequest | AdminListSandBoxStoreManifestVersionsResponse | 0 |
| AdminStatSandBoxStoreObject | Unary | AdminStatSandBoxStoreObjectRequest | AdminStatSandBoxStoreObjectResponse | 0 |
| AdminRestoreSandBoxStoreSnapshot | Unary | AdminRestoreSandBoxStoreSnapshotRequest | AdminRestoreSandBoxStoreSnapshotResponse | 0 |
| AdminHibernateSandBox | Unary | AdminHibernateSandBoxRequest | AdminHibernateSandBoxResponse | 0 |
| AdminRefreshSandBoxEgress | Unary | AdminRefreshSandBoxEgressRequest | AdminRefreshSandBoxEgressResponse | 0 |
| AdminListSandAgents | Unary | AdminListSandAgentsRequest | AdminListSandAgentsResponse | 0 |
| AdminGetSandAgentTranscriptPage | Unary | AdminGetSandAgentTranscriptPageRequest | AdminGetSandAgentTranscriptPageResponse | 0 |
| WatchSandBoxMigration | ServerStreaming | WatchSandBoxMigrationRequest | SandBoxMigrationEvent | 1 |
| AdminWatchSandBoxMigration | ServerStreaming | AdminWatchSandBoxMigrationRequest | SandBoxMigrationEvent | 0 |
| GetSandBoxRunState | Unary | GetSandBoxRunStateRequest | GetSandBoxRunStateResponse | 1 |
| GetSandBoxUpgradeSchedule | Unary | GetSandBoxUpgradeScheduleRequest | GetSandBoxUpgradeScheduleResponse | 1 |
| ScheduleSandBoxUpgrade | Unary | ScheduleSandBoxUpgradeRequest | ScheduleSandBoxUpgradeResponse | 1 |
| CancelSandBoxUpgrade | Unary | CancelSandBoxUpgradeRequest | CancelSandBoxUpgradeResponse | 1 |
| RescheduleSandBoxUpgrade | Unary | RescheduleSandBoxUpgradeRequest | RescheduleSandBoxUpgradeResponse | 1 |
| ListSandBoxes | Unary | ListSandBoxesRequest | ListSandBoxesResponse | 0 |
| NotifySandAgentTurnFinished | Unary | NotifySandAgentTurnFinishedRequest | NotifySandAgentTurnFinishedResponse | 0 |
| ListSandSetupManifests | Unary | ListSandSetupManifestsRequest | ListSandSetupManifestsResponse | 0 |
| ListTeamSandSetupManifests | Unary | ListTeamSandSetupManifestsRequest | ListTeamSandSetupManifestsResponse | 0 |
| SaveTeamSandSetupManifest | Unary | SaveTeamSandSetupManifestRequest | SaveTeamSandSetupManifestResponse | 0 |
| DeleteTeamSandSetupManifest | Unary | DeleteTeamSandSetupManifestRequest | DeleteTeamSandSetupManifestResponse | 0 |
| ListTeamGroupSandSetupManifests | Unary | ListTeamGroupSandSetupManifestsRequest | ListTeamGroupSandSetupManifestsResponse | 0 |
| SaveTeamGroupSandSetupManifest | Unary | SaveTeamGroupSandSetupManifestRequest | SaveTeamGroupSandSetupManifestResponse | 0 |
| DeleteTeamGroupSandSetupManifest | Unary | DeleteTeamGroupSandSetupManifestRequest | DeleteTeamGroupSandSetupManifestResponse | 0 |
| DeleteTeamGrokBot | Unary | DeleteTeamGrokBotRequest | DeleteTeamGrokBotResponse | 0 |
| ListTeamMemberSandBoxes | Unary | ListTeamMemberSandBoxesRequest | ListTeamMemberSandBoxesResponse | 0 |
| KillTeamMemberSandBox | Unary | KillTeamMemberSandBoxRequest | KillTeamMemberSandBoxResponse | 0 |
| RecreateTeamMemberSandBox | Unary | RecreateTeamMemberSandBoxRequest | RecreateSandBoxResponse | 0 |
| GetTeamMemberSandBoxMigrationStatus | Unary | GetTeamMemberSandBoxMigrationStatusRequest | GetTeamMemberSandBoxMigrationStatusResponse | 0 |
| StartBulkTeamMemberSandBoxOperation | Unary | StartBulkTeamMemberSandBoxOperationRequest | StartBulkTeamMemberSandBoxOperationResponse | 0 |
| GetBulkTeamMemberSandBoxOperationStatus | Unary | GetBulkTeamMemberSandBoxOperationStatusRequest | GetBulkTeamMemberSandBoxOperationStatusResponse | 0 |
| MintSandVoiceCallSecret | Unary | MintSandVoiceCallSecretRequest | MintSandVoiceCallSecretResponse | 1 |
| BeginOnePasswordConnection | Unary | BeginOnePasswordConnectionRequest | BeginOnePasswordConnectionResponse | 1 |
| CompleteOnePasswordConnection | Unary | CompleteOnePasswordConnectionRequest | OnePasswordState | 1 |
| GetOnePasswordState | Unary | GetOnePasswordStateRequest | OnePasswordState | 1 |
| SyncOnePasswordConnections | Unary | SyncOnePasswordConnectionsRequest | OnePasswordState | 1 |
| DeleteOnePasswordConnection | Unary | DeleteOnePasswordConnectionRequest | OnePasswordState | 1 |
| StartOnePasswordOAuth | Unary | StartOnePasswordOAuthRequest | StartOnePasswordOAuthResponse | 1 |
| StoreOnePasswordIntegrationKey | Unary | StoreOnePasswordIntegrationKeyRequest | StoreOnePasswordIntegrationKeyResponse | 1 |
| CompleteOnePasswordOAuth | Unary | CompleteOnePasswordOAuthRequest | OnePasswordState | 1 |
| ApproveOnePasswordCredentialRequest | Unary | ApproveOnePasswordCredentialRequestRequest | OnePasswordCredentialDecisionResponse | 1 |
| DenyOnePasswordCredentialRequest | Unary | DenyOnePasswordCredentialRequestRequest | OnePasswordCredentialDecisionResponse | 1 |
| CommitGrokBotTranscriptEntries | Unary | CommitGrokBotTranscriptEntriesRequest | CommitGrokBotTranscriptEntriesResponse | 0 |
| ListGrokBotTranscriptEntries | Unary | ListGrokBotTranscriptEntriesRequest | ListGrokBotTranscriptEntriesResponse | 1 |
| WatchGrokBotTranscripts | ServerStreaming | WatchGrokBotTranscriptsRequest | GrokBotTranscriptWatchFrame | 0 |
| SetGrokBotAgentClientState | Unary | SetGrokBotAgentClientStateRequest | SetGrokBotAgentClientStateResponse | 4 |
| ListGrokBotAgentStatuses | Unary | ListGrokBotAgentStatusesRequest | ListGrokBotAgentStatusesResponse | 0 |
| ListGrokBotAgentSessions | Unary | ListGrokBotAgentSessionsRequest | ListGrokBotAgentSessionsResponse | 1 |
| ReadGrokBotAgentAttachmentChunk | Unary | ReadGrokBotAgentAttachmentChunkRequest | ReadGrokBotAgentAttachmentChunkResponse | 2 |
| ResolveGrokBotAttachmentReads | Unary | ResolveGrokBotAttachmentReadsRequest | ResolveGrokBotAttachmentReadsResponse | 2 |
| ReadGrokBotGroupChatDocument | Unary | ReadGrokBotGroupChatDocumentRequest | ReadGrokBotGroupChatDocumentResponse | 1 |
| ReadGrokBotGroupChatCanvas | Unary | ReadGrokBotGroupChatCanvasRequest | ReadGrokBotGroupChatCanvasResponse | 1 |
| ReadGrokBotMcpAppDocument | Unary | ReadGrokBotMcpAppDocumentRequest | ReadGrokBotMcpAppDocumentResponse | 1 |
| UploadGrokBotAgentAttachmentChunk | Unary | UploadGrokBotAgentAttachmentChunkRequest | UploadGrokBotAgentAttachmentChunkResponse | 0 |
| BeginGrokBotAttachmentUpload | Unary | BeginGrokBotAttachmentUploadRequest | BeginGrokBotAttachmentUploadResponse | 2 |
| PresignGrokBotAttachmentUploadParts | Unary | PresignGrokBotAttachmentUploadPartsRequest | PresignGrokBotAttachmentUploadPartsResponse | 2 |
| CompleteGrokBotAttachmentUpload | Unary | CompleteGrokBotAttachmentUploadRequest | CompleteGrokBotAttachmentUploadResponse | 2 |
| AbortGrokBotAttachmentUpload | Unary | AbortGrokBotAttachmentUploadRequest | AbortGrokBotAttachmentUploadResponse | 2 |
| ReportGrokBotClientPresence | Unary | ReportGrokBotClientPresenceRequest | ReportGrokBotClientPresenceResponse | 1 |
| ReportGrokBotDesktopActivity | Unary | ReportGrokBotDesktopActivityRequest | ReportGrokBotDesktopActivityResponse | 1 |
| ReportGrokBotNotificationPermission | Unary | ReportGrokBotNotificationPermissionRequest | ReportGrokBotNotificationPermissionResponse | 1 |
| ReportSandBoxHostState | Unary | ReportSandBoxHostStateRequest | ReportSandBoxHostStateResponse | 0 |
| ListGrokBotAgentAutomations | Unary | ListGrokBotAgentAutomationsRequest | ListGrokBotAgentAutomationsResponse | 2 |
| ListGrokBotAccountAutomations | Unary | ListGrokBotAccountAutomationsRequest | ListGrokBotAccountAutomationsResponse | 1 |
| ListGrokBotAgentTodos | Unary | ListGrokBotAgentTodosRequest | ListGrokBotAgentTodosResponse | 0 |
| ListGrokBotAgentTasks | Unary | ListGrokBotAgentTasksRequest | ListGrokBotAgentTasksResponse | 1 |
| ListGrokBotSubagents | Unary | ListGrokBotSubagentsRequest | ListGrokBotSubagentsResponse | 1 |
| MarkGrokBotAgentTaskDone | Unary | MarkGrokBotAgentTaskDoneRequest | MarkGrokBotAgentTaskDoneResponse | 1 |
| MarkGrokBotAgentTaskRead | Unary | MarkGrokBotAgentTaskReadRequest | MarkGrokBotAgentTaskReadResponse | 1 |
| ListGrokBotLibraryDocs | Unary | ListGrokBotLibraryDocsRequest | ListGrokBotLibraryDocsResponse | 1 |
| KeepGrokBotTaskList | Unary | KeepGrokBotTaskListRequest | KeepGrokBotTaskListResponse | 0 |
| ListGrokBotTasks | Unary | ListGrokBotTasksRequest | ListGrokBotTasksResponse | 0 |
| DismissGrokBotTask | Unary | DismissGrokBotTaskRequest | DismissGrokBotTaskResponse | 0 |
| MarkGrokBotTasksSeen | Unary | MarkGrokBotTasksSeenRequest | MarkGrokBotTasksSeenResponse | 0 |
| SetGrokBotAgentAutomationEnabled | Unary | SetGrokBotAgentAutomationEnabledRequest | SetGrokBotAgentAutomationEnabledResponse | 1 |
| DeleteGrokBotAgentAutomation | Unary | DeleteGrokBotAgentAutomationRequest | DeleteGrokBotAgentAutomationResponse | 1 |
| ListGrokBotAgentSkills | Unary | ListGrokBotAgentSkillsRequest | ListGrokBotAgentSkillsResponse | 0 |
| GetGrokBotUserMcpSettings | Unary | GetGrokBotUserMcpSettingsRequest | GetGrokBotUserMcpSettingsResponse | 1 |
| SetGrokBotUserMcpSettings | Unary | SetGrokBotUserMcpSettingsRequest | SetGrokBotUserMcpSettingsResponse | 1 |
| GetGrokBotUserRuntimeSettings | Unary | GetGrokBotUserRuntimeSettingsRequest | GetGrokBotUserRuntimeSettingsResponse | 4 |
| UpdateGrokBotUserRuntimeSettings | Unary | UpdateGrokBotUserRuntimeSettingsRequest | UpdateGrokBotUserRuntimeSettingsResponse | 3 |
| GetGrokBotMcpToolPermissions | Unary | GetGrokBotMcpToolPermissionsRequest | GetGrokBotMcpToolPermissionsResponse | 0 |
| SetGrokBotMcpToolPermissions | Unary | SetGrokBotMcpToolPermissionsRequest | SetGrokBotMcpToolPermissionsResponse | 1 |
| SetGrokBotMainAgent | Unary | SetGrokBotMainAgentRequest | SetGrokBotMainAgentResponse | 1 |
| EnsureGrokBotDefaultMainAgent | Unary | EnsureGrokBotDefaultMainAgentRequest | EnsureGrokBotDefaultMainAgentResponse | 1 |
| MarkGrokBotTermsSeen | Unary | MarkGrokBotTermsSeenRequest | MarkGrokBotTermsSeenResponse | 2 |
| GetGrokBotTermsSeen | Unary | GetGrokBotTermsSeenRequest | GetGrokBotTermsSeenResponse | 0 |
| CreateGrokBotAgent | Unary | CreateGrokBotAgentRequest | CreateGrokBotAgentResponse | 0 |
| CreateGrokBotTemporalAgent | Unary | CreateGrokBotAgentRequest | CreateGrokBotAgentResponse | 1 |
| ListGrokBotAgents | Unary | ListGrokBotAgentsRequest | ListGrokBotAgentsResponse | 2 |
| ListGrokBotTeamAgents | Unary | ListGrokBotTeamAgentsRequest | ListGrokBotTeamAgentsResponse | 1 |
| GetGrokBotRuntimeCapabilities | Unary | GetGrokBotRuntimeCapabilitiesRequest | GetGrokBotRuntimeCapabilitiesResponse | 1 |
| ListDeletedGrokBotAgentIds | Unary | ListDeletedGrokBotAgentIdsRequest | ListDeletedGrokBotAgentIdsResponse | 0 |
| EnsureGrokBotBoxHarnessMigrationPass | Unary | EnsureGrokBotBoxHarnessMigrationPassRequest | EnsureGrokBotBoxHarnessMigrationPassResponse | 0 |
| SetGrokBotAgentVisibility | Unary | SetGrokBotAgentVisibilityRequest | SetGrokBotAgentVisibilityResponse | 1 |
| CloneGrokBotAgentToTeam | Unary | CloneGrokBotAgentToTeamRequest | CloneGrokBotAgentToTeamResponse | 1 |
| PublishGrokBotAgent | Unary | PublishGrokBotAgentRequest | PublishGrokBotAgentResponse | 1 |
| UnpublishGrokBotAgent | Unary | UnpublishGrokBotAgentRequest | UnpublishGrokBotAgentResponse | 1 |
| AddGrokBotAgentManager | Unary | AddGrokBotAgentManagerRequest | AddGrokBotAgentManagerResponse | 1 |
| RemoveGrokBotAgentManager | Unary | RemoveGrokBotAgentManagerRequest | RemoveGrokBotAgentManagerResponse | 1 |
| ListGrokBotAgentManagers | Unary | ListGrokBotAgentManagersRequest | ListGrokBotAgentManagersResponse | 1 |
| SetGrokBotAgentMeetingsVisibility | Unary | SetGrokBotAgentMeetingsVisibilityRequest | SetGrokBotAgentMeetingsVisibilityResponse | 1 |
| ListGrokBotAgentMeetings | Unary | ListGrokBotAgentMeetingsRequest | ListGrokBotAgentMeetingsResponse | 1 |
| AddGrokBotAgentAccessPrincipal | Unary | AddGrokBotAgentAccessPrincipalRequest | AddGrokBotAgentAccessPrincipalResponse | 0 |
| RemoveGrokBotAgentAccessPrincipal | Unary | RemoveGrokBotAgentAccessPrincipalRequest | RemoveGrokBotAgentAccessPrincipalResponse | 0 |
| ListGrokBotAgentAccessPrincipals | Unary | ListGrokBotAgentAccessPrincipalsRequest | ListGrokBotAgentAccessPrincipalsResponse | 0 |
| GetGrokBotAgentAccess | Unary | GetGrokBotAgentAccessRequest | GetGrokBotAgentAccessResponse | 1 |
| UpdateGrokBotAgentAccess | Unary | UpdateGrokBotAgentAccessRequest | UpdateGrokBotAgentAccessResponse | 1 |
| GetGrokBotAgentLinkAccess | Unary | GetGrokBotAgentLinkAccessRequest | GetGrokBotAgentLinkAccessResponse | 1 |
| UpdateGrokBotAgent | Unary | UpdateGrokBotAgentRequest | UpdateGrokBotAgentResponse | 1 |
| SetGrokBotAgentVoice | Unary | SetGrokBotAgentVoiceRequest | SetGrokBotAgentVoiceResponse | 1 |
| SetGrokBotAgentDraftingDisabled | Unary | SetGrokBotAgentDraftingDisabledRequest | SetGrokBotAgentDraftingDisabledResponse | 1 |
| DeleteGrokBotAgent | Unary | DeleteGrokBotAgentRequest | DeleteGrokBotAgentResponse | 1 |
| ListGrokBotSecrets | Unary | ListGrokBotSecretsRequest | ListGrokBotSecretsResponse | 1 |
| PutGrokBotSecret | Unary | PutGrokBotSecretRequest | PutGrokBotSecretResponse | 1 |
| DeleteGrokBotSecret | Unary | DeleteGrokBotSecretRequest | DeleteGrokBotSecretResponse | 1 |
| ListGrokBotVaultCredentials | Unary | ListGrokBotVaultCredentialsRequest | ListGrokBotVaultCredentialsResponse | 1 |
| PutGrokBotVaultCredential | Unary | PutGrokBotVaultCredentialRequest | PutGrokBotVaultCredentialResponse | 1 |
| DeleteGrokBotVaultCredential | Unary | DeleteGrokBotVaultCredentialRequest | DeleteGrokBotVaultCredentialResponse | 1 |
| CreateGrokBotEmailInbox | Unary | CreateGrokBotEmailInboxRequest | CreateGrokBotEmailInboxResponse | 1 |
| ListGrokBotEmailInboxes | Unary | ListGrokBotEmailInboxesRequest | ListGrokBotEmailInboxesResponse | 1 |
| CheckGrokBotEmailAddressAvailability | Unary | CheckGrokBotEmailAddressAvailabilityRequest | CheckGrokBotEmailAddressAvailabilityResponse | 0 |
| DeleteGrokBotEmailInbox | Unary | DeleteGrokBotEmailInboxRequest | DeleteGrokBotEmailInboxResponse | 0 |
| SendGrokBotEmail | Unary | SendGrokBotEmailRequest | SendGrokBotEmailResponse | 0 |
| SearchGrokBotEmailThreads | Unary | SearchGrokBotEmailThreadsRequest | SearchGrokBotEmailThreadsResponse | 0 |
| ReadGrokBotEmailThread | Unary | ReadGrokBotEmailThreadRequest | ReadGrokBotEmailThreadResponse | 0 |
| ReadGrokBotEmailAttachment | Unary | ReadGrokBotEmailAttachmentRequest | ReadGrokBotEmailAttachmentResponse | 0 |
| GetGrokBotAgentPlugins | Unary | GetGrokBotAgentPluginsRequest | GetGrokBotAgentPluginsResponse | 2 |
| SetGrokBotAgentPlugins | Unary | SetGrokBotAgentPluginsRequest | SetGrokBotAgentPluginsResponse | 1 |
| SetGrokBotAgentPluginVariables | Unary | SetGrokBotAgentPluginVariablesRequest | SetGrokBotAgentPluginVariablesResponse | 1 |
| UpdateGrokBotAgentMarketplace | Unary | UpdateGrokBotAgentMarketplaceRequest | UpdateGrokBotAgentMarketplaceResponse | 0 |
| AddGrokBotAgentSkill | Unary | AddGrokBotAgentSkillRequest | AddGrokBotAgentSkillResponse | 1 |
| UpdateGrokBotAgentSkill | Unary | UpdateGrokBotAgentSkillRequest | UpdateGrokBotAgentSkillResponse | 1 |
| RemoveGrokBotAgentSkill | Unary | RemoveGrokBotAgentSkillRequest | RemoveGrokBotAgentSkillResponse | 1 |
| GetGrokBotAgentPluginFile | Unary | GetGrokBotAgentPluginFileRequest | GetGrokBotAgentPluginFileResponse | 0 |
| BeginGrokBotAgentFileUpload | Unary | BeginGrokBotAgentFileUploadRequest | BeginGrokBotAgentFileUploadResponse | 1 |
| FinishGrokBotAgentFileUpload | Unary | FinishGrokBotAgentFileUploadRequest | FinishGrokBotAgentFileUploadResponse | 1 |
| ListGrokBotAgentFiles | Unary | ListGrokBotAgentFilesRequest | ListGrokBotAgentFilesResponse | 1 |
| DeleteGrokBotAgentFile | Unary | DeleteGrokBotAgentFileRequest | DeleteGrokBotAgentFileResponse | 1 |
| GetGrokBotTeamContextSummary | Unary | GetGrokBotTeamContextSummaryRequest | GetGrokBotTeamContextSummaryResponse | 0 |
| ListGrokBotUserBotMemories | Unary | ListGrokBotUserBotMemoriesRequest | ListGrokBotUserBotMemoriesResponse | 1 |
| PromoteGrokBotMemoriesToTeam | Unary | PromoteGrokBotMemoriesToTeamRequest | PromoteGrokBotMemoriesToTeamResponse | 1 |
| CreateGrokBotTemplate | Unary | CreateGrokBotTemplateRequest | CreateGrokBotTemplateResponse | 0 |
| ListGrokBotTemplates | Unary | ListGrokBotTemplatesRequest | ListGrokBotTemplatesResponse | 0 |
| DeleteGrokBotTemplate | Unary | DeleteGrokBotTemplateRequest | DeleteGrokBotTemplateResponse | 1 |
| SetGrokBotTemplateVisibility | Unary | SetGrokBotTemplateVisibilityRequest | SetGrokBotTemplateVisibilityResponse | 1 |
| ActivateGrokBotTemplateVersion | Unary | ActivateGrokBotTemplateVersionRequest | ActivateGrokBotTemplateVersionResponse | 1 |
| GetGrokBotTemplateVersion | Unary | GetGrokBotTemplateVersionRequest | GetGrokBotTemplateVersionResponse | 1 |
| GetGrokBotTemplateForSourceAgent | Unary | GetGrokBotTemplateForSourceAgentRequest | GetGrokBotTemplateForSourceAgentResponse | 1 |
| GetGrokBotTemplateExportPolicy | Unary | GetGrokBotTemplateExportPolicyRequest | GetGrokBotTemplateExportPolicyResponse | 1 |
| GetPublicGrokBotTemplate | Unary | GetPublicGrokBotTemplateRequest | GetPublicGrokBotTemplateResponse | 0 |
| ListPublicGrokBotMarketplaceListings | Unary | ListPublicGrokBotMarketplaceListingsRequest | ListPublicGrokBotMarketplaceListingsResponse | 1 |
| GetPublicGrokBotMarketplaceListing | Unary | GetPublicGrokBotMarketplaceListingRequest | GetPublicGrokBotMarketplaceListingResponse | 0 |
| GetGrokBotTemplateImportDetails | Unary | GetGrokBotTemplateImportDetailsRequest | GetGrokBotTemplateImportDetailsResponse | 1 |
| CreateGrokBotAgentFromTemplate | Unary | CreateGrokBotAgentFromTemplateRequest | CreateGrokBotAgentFromTemplateResponse | 1 |
| SendGrokBotUserMessage | Unary | SendGrokBotUserMessageRequest | SendGrokBotUserMessageResponse | 1 |
| GetGrokBotSendStatus | Unary | GetGrokBotSendStatusRequest | GetGrokBotSendStatusResponse | 2 |
| StartGrokBotImagePrecaption | Unary | StartGrokBotImagePrecaptionRequest | StartGrokBotImagePrecaptionResponse | 1 |
| GetGrokBotCloudAgentWatchers | Unary | GetGrokBotCloudAgentWatchersRequest | GetGrokBotCloudAgentWatchersResponse | 0 |
| InterruptGrokBotAgentRun | Unary | InterruptGrokBotAgentRunRequest | InterruptGrokBotAgentRunResponse | 1 |
| StartFreshGrokBotConversation | Unary | StartFreshGrokBotConversationRequest | StartFreshGrokBotConversationResponse | 1 |
| RollBackGrokBotConversation | Unary | RollBackGrokBotConversationRequest | RollBackGrokBotConversationResponse | 1 |
| RespondGrokBotWidget | Unary | RespondGrokBotWidgetRequest | RespondGrokBotWidgetResponse | 1 |
| SubmitGrokBotSecret | Unary | SubmitGrokBotSecretRequest | SubmitGrokBotSecretResponse | 1 |
| ResolveGrokBotCredentialRequest | Unary | ResolveGrokBotCredentialRequestRequest | ResolveGrokBotCredentialRequestResponse | 1 |
| DismissGrokBotWidget | Unary | DismissGrokBotWidgetRequest | DismissGrokBotWidgetResponse | 1 |
| SubmitGrokBotUserForm | Unary | SubmitGrokBotUserFormRequest | SubmitGrokBotUserFormResponse | 1 |
| DismissGrokBotUserForm | Unary | DismissGrokBotUserFormRequest | DismissGrokBotUserFormResponse | 1 |
| SendGrokBotDraft | Unary | SendGrokBotDraftRequest | SendGrokBotDraftResponse | 1 |
| DiscardGrokBotDraft | Unary | DiscardGrokBotDraftRequest | DiscardGrokBotDraftResponse | 1 |
| ReactToGrokBotMessage | Unary | ReactToGrokBotMessageRequest | ReactToGrokBotMessageResponse | 1 |
| VoteGrokBotFeedback | Unary | VoteGrokBotFeedbackRequest | VoteGrokBotFeedbackResponse | 1 |
| SendGrokBotAgentMessage | Unary | SendGrokBotAgentMessageRequest | SendGrokBotAgentMessageResponse | 0 |
| ResolveGrokBotAutoReviewApproval | Unary | ResolveGrokBotAutoReviewApprovalRequest | ResolveGrokBotAutoReviewApprovalResponse | 1 |
| ResolveGrokBotLocalToolPermission | Unary | ResolveGrokBotLocalToolPermissionRequest | ResolveGrokBotLocalToolPermissionResponse | 1 |
| ResolveGrokBotConnectorGrant | Unary | ResolveGrokBotConnectorGrantRequest | ResolveGrokBotConnectorGrantResponse | 1 |
| ClearGrokBotConnectorAlwaysAllow | Unary | ClearGrokBotConnectorAlwaysAllowRequest | ClearGrokBotConnectorAlwaysAllowResponse | 1 |
| RaiseGrokBotVirtualCard | Unary | RaiseGrokBotVirtualCardRequest | RaiseGrokBotVirtualCardResponse | 0 |
| ResolveGrokBotVirtualCardApproval | Unary | ResolveGrokBotVirtualCardApprovalRequest | ResolveGrokBotVirtualCardApprovalResponse | 1 |
| ListGrokBotStripeLinkPaymentMethods | Unary | ListGrokBotStripeLinkPaymentMethodsRequest | ListGrokBotStripeLinkPaymentMethodsResponse | 1 |
| StartPasskeyEnrollment | Unary | StartPasskeyEnrollmentRequest | StartPasskeyEnrollmentResponse | 1 |
| VerifyPasskeyEnrollmentCode | Unary | VerifyPasskeyEnrollmentCodeRequest | VerifyPasskeyEnrollmentCodeResponse | 1 |
| BeginPasskeyRegistration | Unary | BeginPasskeyRegistrationRequest | BeginPasskeyRegistrationResponse | 1 |
| FinishPasskeyRegistration | Unary | FinishPasskeyRegistrationRequest | FinishPasskeyRegistrationResponse | 0 |
| GetPasskeyCeremony | Unary | GetPasskeyCeremonyRequest | GetPasskeyCeremonyResponse | 0 |
| GetPasskeyCeremonyStatus | Unary | GetPasskeyCeremonyStatusRequest | GetPasskeyCeremonyStatusResponse | 1 |
| ListPasskeys | Unary | ListPasskeysRequest | ListPasskeysResponse | 1 |
| RevokePasskey | Unary | RevokePasskeyRequest | RevokePasskeyResponse | 1 |
| BeginGrokBotSpendApproval | Unary | BeginGrokBotSpendApprovalRequest | BeginGrokBotSpendApprovalResponse | 1 |
| FinishGrokBotSpendApprovalAssertion | Unary | FinishGrokBotSpendApprovalAssertionRequest | FinishGrokBotSpendApprovalAssertionResponse | 0 |
| IssueGrokBotUserComputerCredential | Unary | IssueGrokBotUserComputerCredentialRequest | IssueGrokBotUserComputerCredentialResponse | 1 |
| WatchGrokBotUserComputerRequests | ServerStreaming | WatchGrokBotUserComputerRequestsRequest | WatchGrokBotUserComputerRequestsEvent | 0 |
| PollGrokBotUserComputerRequests | Unary | PollGrokBotUserComputerRequestsRequest | PollGrokBotUserComputerRequestsResponse | 0 |
| SubmitGrokBotUserComputerResponses | Unary | SubmitGrokBotUserComputerResponsesRequest | SubmitGrokBotUserComputerResponsesResponse | 0 |
| ListGrokBotUserComputers | Unary | ListGrokBotUserComputersRequest | ListGrokBotUserComputersResponse | 0 |
| PullGrokBotMeetings | Unary | PullGrokBotMeetingsRequest | PullGrokBotMeetingsResponse | 0 |
| ReportGrokBotMeetings | Unary | ReportGrokBotMeetingsRequest | ReportGrokBotMeetingsResponse | 0 |
| ListGrokBotServerMeetings | Unary | ListGrokBotServerMeetingsRequest | ListGrokBotServerMeetingsResponse | 1 |
| LeaveGrokBotServerMeeting | Unary | LeaveGrokBotServerMeetingRequest | LeaveGrokBotServerMeetingResponse | 1 |
| GetGrokBotMeetingRecord | Unary | GetGrokBotMeetingRecordRequest | GetGrokBotMeetingRecordResponse | 1 |
| OpenGrokBotUserComputerRequest | ServerStreaming | OpenGrokBotUserComputerRequestRequest | GrokBotUserComputerResponseFrame | 0 |
| CancelGrokBotUserComputerRequest | Unary | CancelGrokBotUserComputerRequestRequest | CancelGrokBotUserComputerRequestResponse | 0 |
| EndGrokBotBoxHandoff | Unary | EndGrokBotBoxHandoffRequest | EndGrokBotBoxHandoffResponse | 1 |
| RequestGrokBotRoomMemberTurn | Unary | RequestGrokBotRoomMemberTurnRequest | RequestGrokBotRoomMemberTurnResponse | 0 |
| CancelGrokBotRoomMemberTurn | Unary | CancelGrokBotRoomMemberTurnRequest | CancelGrokBotRoomMemberTurnResponse | 0 |
| DeliverGrokBotRoomMemberTurnResult | Unary | DeliverGrokBotRoomMemberTurnResultRequest | DeliverGrokBotRoomMemberTurnResultResponse | 0 |
| CreateGrokBotRoom | Unary | CreateGrokBotRoomRequest | CreateGrokBotRoomResponse | 1 |
| SetGrokBotRoomMembers | Unary | SetGrokBotRoomMembersRequest | SetGrokBotRoomMembersResponse | 1 |
| AddGrokBotRoomPeople | Unary | AddGrokBotRoomPeopleRequest | AddGrokBotRoomPeopleResponse | 1 |
| RemoveGrokBotRoomPeople | Unary | RemoveGrokBotRoomPeopleRequest | RemoveGrokBotRoomPeopleResponse | 1 |
| EnsureGrokBotPullRequestChat | Unary | EnsureGrokBotPullRequestChatRequest | EnsureGrokBotPullRequestChatResponse | 0 |
| ListGrokBotPullRequestChatEntries | Unary | ListGrokBotPullRequestChatEntriesRequest | ListGrokBotTranscriptEntriesResponse | 0 |
| SendGrokBotPullRequestChatMessage | Unary | SendGrokBotPullRequestChatMessageRequest | SendGrokBotPullRequestChatMessageResponse | 0 |
| GetGrokBotSlackInstallState | Unary | GetGrokBotSlackInstallStateRequest | GetGrokBotSlackInstallStateResponse | 1 |
| StartGrokBotSlackConnect | Unary | StartGrokBotSlackConnectRequest | StartGrokBotSlackConnectResponse | 1 |
| InstallGrokBotSlackApp | Unary | InstallGrokBotSlackAppRequest | InstallGrokBotSlackAppResponse | 1 |
| ReinstallGrokBotSlackApp | Unary | ReinstallGrokBotSlackAppRequest | ReinstallGrokBotSlackAppResponse | 1 |
| UninstallGrokBotSlackApp | Unary | UninstallGrokBotSlackAppRequest | UninstallGrokBotSlackAppResponse | 1 |
| GetGrokBotTeamsInstallState | Unary | GetGrokBotTeamsInstallStateRequest | GetGrokBotTeamsInstallStateResponse | 0 |
| StartGrokBotTeamsConnect | Unary | StartGrokBotTeamsConnectRequest | StartGrokBotTeamsConnectResponse | 0 |
| InstallGrokBotTeamsApp | Unary | InstallGrokBotTeamsAppRequest | InstallGrokBotTeamsAppResponse | 0 |
| ReinstallGrokBotTeamsApp | Unary | ReinstallGrokBotTeamsAppRequest | ReinstallGrokBotTeamsAppResponse | 0 |
| UninstallGrokBotTeamsApp | Unary | UninstallGrokBotTeamsAppRequest | UninstallGrokBotTeamsAppResponse | 0 |
| AddGrokBotTeamsAppToTeam | Unary | AddGrokBotTeamsAppToTeamRequest | AddGrokBotTeamsAppToTeamResponse | 0 |
| CreateGrokBotMarketplaceListingInternal | Unary | CreateGrokBotMarketplaceListingInternalRequest | GrokBotMarketplaceListing | 0 |
| ListGrokBotMarketplaceListingsInternal | Unary | ListGrokBotMarketplaceListingsInternalRequest | ListGrokBotMarketplaceListingsInternalResponse | 0 |
| GetGrokBotMarketplaceListingInternal | Unary | GetGrokBotMarketplaceListingInternalRequest | GrokBotMarketplaceListing | 0 |
| UpdateGrokBotMarketplaceListingInternal | Unary | UpdateGrokBotMarketplaceListingInternalRequest | GrokBotMarketplaceListing | 0 |
| SetGrokBotMarketplaceListingStatusInternal | Unary | SetGrokBotMarketplaceListingStatusInternalRequest | GrokBotMarketplaceListing | 0 |
| PresignGrokBotMarketplaceImageUploadInternal | Unary | PresignGrokBotMarketplaceImageUploadInternalRequest | PresignGrokBotMarketplaceImageUploadInternalResponse | 0 |
| CreateGrokBotMarketplaceCreatorInternal | Unary | CreateGrokBotMarketplaceCreatorInternalRequest | GrokBotMarketplaceCreator | 0 |
| ListGrokBotMarketplaceCreatorsInternal | Unary | ListGrokBotMarketplaceCreatorsInternalRequest | ListGrokBotMarketplaceCreatorsInternalResponse | 0 |
| GetGrokBotMarketplaceCreatorInternal | Unary | GetGrokBotMarketplaceCreatorInternalRequest | GrokBotMarketplaceCreator | 0 |
| UpdateGrokBotMarketplaceCreatorInternal | Unary | UpdateGrokBotMarketplaceCreatorInternalRequest | GrokBotMarketplaceCreator | 0 |
| PresignGrokBotMarketplaceCreatorProfileUploadInternal | Unary | PresignGrokBotMarketplaceCreatorProfileUploadInternalRequest | PresignGrokBotMarketplaceImageUploadInternalResponse | 0 |
| PreviewGrokBotMarketplaceSourceInternal | Unary | PreviewGrokBotMarketplaceSourceInternalRequest | PreviewGrokBotMarketplaceSourceInternalResponse | 0 |
| CreateGrokBotMarketplaceCategoryInternal | Unary | CreateGrokBotMarketplaceCategoryInternalRequest | GrokBotMarketplaceCategory | 0 |
| ListGrokBotMarketplaceCategoriesInternal | Unary | ListGrokBotMarketplaceCategoriesInternalRequest | ListGrokBotMarketplaceCategoriesInternalResponse | 0 |
| GetGrokBotMarketplaceCategoryInternal | Unary | GetGrokBotMarketplaceCategoryInternalRequest | GrokBotMarketplaceCategory | 0 |
| UpdateGrokBotMarketplaceCategoryInternal | Unary | UpdateGrokBotMarketplaceCategoryInternalRequest | GrokBotMarketplaceCategory | 0 |
| GetGrokBotMarketplaceListingTemplateInternal | Unary | GetGrokBotMarketplaceListingTemplateInternalRequest | GetGrokBotMarketplaceListingTemplateInternalResponse | 0 |
| GetGrokBotMarketplaceListingSourceTemplateInternal | Unary | GetGrokBotMarketplaceListingSourceTemplateInternalRequest | GetGrokBotMarketplaceListingSourceTemplateInternalResponse | 0 |
| DeleteGrokBotMarketplaceListingInternal | Unary | DeleteGrokBotMarketplaceListingInternalRequest | DeleteGrokBotMarketplaceListingInternalResponse | 0 |
| UpdateGrokBotMarketplaceListingTemplateInternal | Unary | UpdateGrokBotMarketplaceListingTemplateInternalRequest | GetGrokBotMarketplaceListingTemplateInternalResponse | 0 |
| GetGrokBotTemplateForOperatorInternal | Unary | GetGrokBotTemplateForOperatorInternalRequest | GrokBotTemplateOperatorView | 0 |
| SetGrokBotTemplateCreatorAttributionInternal | Unary | SetGrokBotTemplateCreatorAttributionInternalRequest | GrokBotTemplateOperatorView | 0 |
| GetGrokBotHarnessMigrationStatusInternal | Unary | GetGrokBotHarnessMigrationStatusInternalRequest | GetGrokBotHarnessMigrationStatusInternalResponse | 0 |
| ClearGrokBotHarnessMigrationHoldInternal | Unary | ClearGrokBotHarnessMigrationHoldInternalRequest | ClearGrokBotHarnessMigrationHoldInternalResponse | 0 |
| PreviewInternalPrimaryBotMigration | Unary | PreviewInternalPrimaryBotMigrationRequest | PreviewInternalPrimaryBotMigrationResponse | 0 |
| ExecuteInternalPrimaryBotMigration | Unary | ExecuteInternalPrimaryBotMigrationRequest | ExecuteInternalPrimaryBotMigrationResponse | 0 |
| ListGrokBotUserFormVaultEntries | Unary | ListGrokBotUserFormVaultEntriesRequest | ListGrokBotUserFormVaultEntriesResponse | 0 |
| UpsertGrokBotUserFormVaultEntry | Unary | UpsertGrokBotUserFormVaultEntryRequest | UpsertGrokBotUserFormVaultEntryResponse | 0 |
| DeleteGrokBotUserFormVaultEntry | Unary | DeleteGrokBotUserFormVaultEntryRequest | DeleteGrokBotUserFormVaultEntryResponse | 0 |
| ListGrokBotUserFormVaultKeys | Unary | ListGrokBotUserFormVaultKeysRequest | ListGrokBotUserFormVaultKeysResponse | 0 |
| PublishGrokBotUserSkillsSnapshot | Unary | PublishGrokBotUserSkillsSnapshotRequest | PublishGrokBotUserSkillsSnapshotResponse | 0 |
| InvalidateGrokBotUserSkillsCache | Unary | InvalidateGrokBotUserSkillsCacheRequest | InvalidateGrokBotUserSkillsCacheResponse | 0 |
| GetGrokBotOnePasswordExtensionDownload | Unary | GetGrokBotOnePasswordExtensionDownloadRequest | GetGrokBotOnePasswordExtensionDownloadResponse | 0 |
| AdminListGrokBotSessionBoxes | Unary | AdminListGrokBotSessionBoxesRequest | AdminListGrokBotSessionBoxesResponse | 0 |
| AdminGetGrokBotSessionBox | Unary | AdminGetGrokBotSessionBoxRequest | AdminGetGrokBotSessionBoxResponse | 0 |
| AdminReapGrokBotSessionBoxNow | Unary | AdminReapGrokBotSessionBoxNowRequest | AdminReapGrokBotSessionBoxNowResponse | 0 |
| AdminHibernateGrokBotSessionBox | Unary | AdminHibernateGrokBotSessionBoxRequest | AdminHibernateGrokBotSessionBoxResponse | 0 |
| AdminForceDeleteGrokBotSessionBox | Unary | AdminForceDeleteGrokBotSessionBoxRequest | AdminForceDeleteGrokBotSessionBoxResponse | 0 |
| AdminGetGrokBotAgentDefinition | Unary | AdminGetGrokBotAgentDefinitionRequest | AdminGetGrokBotAgentDefinitionResponse | 0 |
| AdminListGrokBotTeamAgents | Unary | AdminListGrokBotTeamAgentsRequest | AdminListGrokBotTeamAgentsResponse | 0 |
| AdminDeleteGrokBotAgent | Unary | AdminDeleteGrokBotAgentRequest | AdminDeleteGrokBotAgentResponse | 0 |
| AdminRetryGrokBotSlackAppRemoval | Unary | AdminRetryGrokBotSlackAppRemovalRequest | AdminRetryGrokBotSlackAppRemovalResponse | 0 |
| AdminGetGrokBotTeamAgentSharedState | Unary | AdminGetGrokBotTeamAgentSharedStateRequest | AdminGetGrokBotTeamAgentSharedStateResponse | 0 |
| AdminListGrokBotEmailInboxes | Unary | AdminListGrokBotEmailInboxesRequest | AdminListGrokBotEmailInboxesResponse | 0 |
| AdminListGrokBotEmailMessages | Unary | AdminListGrokBotEmailMessagesRequest | AdminListGrokBotEmailMessagesResponse | 0 |
| AdminSendGrokBotTestEmail | Unary | AdminSendGrokBotTestEmailRequest | AdminSendGrokBotTestEmailResponse | 0 |
| AdminGetGrokBotEmailSendingState | Unary | AdminGetGrokBotEmailSendingStateRequest | AdminGrokBotEmailSendingStateResponse | 0 |
| AdminSetGrokBotEmailSendingState | Unary | AdminSetGrokBotEmailSendingStateRequest | AdminGrokBotEmailSendingStateResponse | 0 |
| AdminGetGrokBotEmailLimits | Unary | AdminGetGrokBotEmailLimitsRequest | AdminGrokBotEmailLimitsResponse | 0 |
| AdminSetGrokBotEmailThresholds | Unary | AdminSetGrokBotEmailThresholdsRequest | AdminGrokBotEmailLimitsResponse | 0 |
| AdminListGrokBotEmailSuppressions | Unary | AdminListGrokBotEmailSuppressionsRequest | AdminListGrokBotEmailSuppressionsResponse | 0 |
| AdminAddGrokBotEmailSuppression | Unary | AdminAddGrokBotEmailSuppressionRequest | AdminAddGrokBotEmailSuppressionResponse | 0 |
| AdminRemoveGrokBotEmailSuppressions | Unary | AdminRemoveGrokBotEmailSuppressionsRequest | AdminRemoveGrokBotEmailSuppressionsResponse | 0 |
| AdminLookupGrokBotMeetings | Unary | AdminLookupGrokBotMeetingsRequest | AdminLookupGrokBotMeetingsResponse | 0 |
| AdminLookupGrokBotMeetingsByAgent | Unary | AdminLookupGrokBotMeetingsByAgentRequest | AdminLookupGrokBotMeetingsByAgentResponse | 0 |
| AdminGetGrokBotMeetingJoinConsent | Unary | AdminGetGrokBotMeetingJoinConsentRequest | AdminGetGrokBotMeetingJoinConsentResponse | 0 |
| AdminGetGrokBotMeetingTranscript | Unary | AdminGetGrokBotMeetingTranscriptRequest | AdminGetGrokBotMeetingTranscriptResponse | 0 |
| AdminMintGrokBotMeetingAvatarLinks | Unary | AdminMintGrokBotMeetingAvatarLinksRequest | AdminMintGrokBotMeetingAvatarLinksResponse | 0 |
| AdminGetGrokBotMeetingSummaryVersions | Unary | AdminGetGrokBotMeetingSummaryVersionsRequest | AdminGetGrokBotMeetingSummaryVersionsResponse | 0 |
| GetGrokBotEgressPolicy | Unary | GetGrokBotEgressPolicyRequest | GetGrokBotEgressPolicyResponse | 1 |
| VoiceCallHarnessSession | Unary | VoiceCallHarnessSessionRequest | VoiceCallHarnessSessionResponse | 2 |
| VoiceCallHarnessTool | Unary | VoiceCallHarnessToolRequest | VoiceCallHarnessToolResponse | 2 |
| CreateGrokBotChangelogInternal | Unary | CreateGrokBotChangelogInternalRequest | GrokBotChangelog | 0 |
| ListGrokBotChangelogsInternal | Unary | ListGrokBotChangelogsInternalRequest | ListGrokBotChangelogsInternalResponse | 0 |
| GetGrokBotChangelogInternal | Unary | GetGrokBotChangelogInternalRequest | GrokBotChangelog | 0 |
| UpdateGrokBotChangelogInternal | Unary | UpdateGrokBotChangelogInternalRequest | GrokBotChangelog | 0 |
| SetGrokBotChangelogStatusInternal | Unary | SetGrokBotChangelogStatusInternalRequest | GrokBotChangelog | 0 |
| EnsureGrokBotCursorMainBot | Unary | EnsureGrokBotCursorMainBotRequest | EnsureGrokBotCursorMainBotResponse | 0 |

### aiserver.v1.SandBoxService

| Method | 类型 | Request | Response | 静态引用数 |
| --- | --- | --- | --- | --- |
| EnsureSandBox | Unary | EnsureSandBoxRequest | EnsureSandBoxResponse | 1 |
| EnsureSandBoxWindow | Unary | EnsureSandBoxWindowRequest | EnsureSandBoxResponse | 0 |
| RecreateSandBox | Unary | RecreateSandBoxRequest | RecreateSandBoxResponse | 1 |
| ForceRecreateSandBox | Unary | ForceRecreateSandBoxRequest | RecreateSandBoxResponse | 1 |
| AdminRecreateSandBox | Unary | AdminRecreateSandBoxRequest | RecreateSandBoxResponse | 0 |
| AdminForceRecreateSandBox | Unary | AdminForceRecreateSandBoxRequest | RecreateSandBoxResponse | 0 |
| AdminBreakGlassDeleteSandBoxPod | Unary | AdminBreakGlassDeleteSandBoxPodRequest | AdminBreakGlassDeleteSandBoxPodResponse | 0 |
| PresignSandBoxStoreWrites | Unary | PresignSandBoxStoreWritesRequest | PresignSandBoxStoreWritesResponse | 0 |
| CompleteSandBoxStoreMultipartWrites | Unary | CompleteSandBoxStoreMultipartWritesRequest | CompleteSandBoxStoreMultipartWritesResponse | 0 |
| CommitSandBoxStoreManifest | Unary | CommitSandBoxStoreManifestRequest | CommitSandBoxStoreManifestResponse | 0 |
| AbortSandBoxStoreMultipartWrites | Unary | AbortSandBoxStoreMultipartWritesRequest | AbortSandBoxStoreMultipartWritesResponse | 0 |
| PresignSandBoxStoreReads | Unary | PresignSandBoxStoreReadsRequest | PresignSandBoxStoreReadsResponse | 1 |
| StatSandBoxStoreObject | Unary | StatSandBoxStoreObjectRequest | StatSandBoxStoreObjectResponse | 0 |
| ListSandBoxStoreObjects | Unary | ListSandBoxStoreObjectsRequest | ListSandBoxStoreObjectsResponse | 0 |
| AdminGetSandBoxStoreStatus | Unary | AdminSandBoxStoreStatusRequest | AdminSandBoxStoreStatusResponse | 0 |
| AdminUpdateSandBoxHost | Unary | AdminUpdateSandBoxHostRequest | AdminUpdateSandBoxHostResponse | 0 |
| AdminGetSandBoxHostStatus | Unary | AdminSandBoxHostStatusRequest | AdminSandBoxHostStatusResponse | 0 |
| AdminSnapshotSandBoxStore | Unary | AdminSnapshotSandBoxStoreRequest | AdminSnapshotSandBoxStoreResponse | 0 |
| AdminListSandBoxStoreManifestVersions | Unary | AdminListSandBoxStoreManifestVersionsRequest | AdminListSandBoxStoreManifestVersionsResponse | 0 |
| AdminStatSandBoxStoreObject | Unary | AdminStatSandBoxStoreObjectRequest | AdminStatSandBoxStoreObjectResponse | 0 |
| AdminRestoreSandBoxStoreSnapshot | Unary | AdminRestoreSandBoxStoreSnapshotRequest | AdminRestoreSandBoxStoreSnapshotResponse | 0 |
| AdminHibernateSandBox | Unary | AdminHibernateSandBoxRequest | AdminHibernateSandBoxResponse | 0 |
| AdminRefreshSandBoxEgress | Unary | AdminRefreshSandBoxEgressRequest | AdminRefreshSandBoxEgressResponse | 0 |
| AdminListSandAgents | Unary | AdminListSandAgentsRequest | AdminListSandAgentsResponse | 0 |
| AdminGetSandAgentTranscriptPage | Unary | AdminGetSandAgentTranscriptPageRequest | AdminGetSandAgentTranscriptPageResponse | 0 |
| WatchSandBoxMigration | ServerStreaming | WatchSandBoxMigrationRequest | SandBoxMigrationEvent | 1 |
| AdminWatchSandBoxMigration | ServerStreaming | AdminWatchSandBoxMigrationRequest | SandBoxMigrationEvent | 0 |
| GetSandBoxRunState | Unary | GetSandBoxRunStateRequest | GetSandBoxRunStateResponse | 1 |
| GetSandBoxUpgradeSchedule | Unary | GetSandBoxUpgradeScheduleRequest | GetSandBoxUpgradeScheduleResponse | 1 |
| ScheduleSandBoxUpgrade | Unary | ScheduleSandBoxUpgradeRequest | ScheduleSandBoxUpgradeResponse | 1 |
| CancelSandBoxUpgrade | Unary | CancelSandBoxUpgradeRequest | CancelSandBoxUpgradeResponse | 1 |
| RescheduleSandBoxUpgrade | Unary | RescheduleSandBoxUpgradeRequest | RescheduleSandBoxUpgradeResponse | 1 |
| ListSandBoxes | Unary | ListSandBoxesRequest | ListSandBoxesResponse | 0 |
| NotifySandAgentTurnFinished | Unary | NotifySandAgentTurnFinishedRequest | NotifySandAgentTurnFinishedResponse | 0 |
| ListSandSetupManifests | Unary | ListSandSetupManifestsRequest | ListSandSetupManifestsResponse | 0 |
| ListTeamSandSetupManifests | Unary | ListTeamSandSetupManifestsRequest | ListTeamSandSetupManifestsResponse | 0 |
| SaveTeamSandSetupManifest | Unary | SaveTeamSandSetupManifestRequest | SaveTeamSandSetupManifestResponse | 0 |
| DeleteTeamSandSetupManifest | Unary | DeleteTeamSandSetupManifestRequest | DeleteTeamSandSetupManifestResponse | 0 |
| ListTeamMemberSandBoxes | Unary | ListTeamMemberSandBoxesRequest | ListTeamMemberSandBoxesResponse | 0 |
| KillTeamMemberSandBox | Unary | KillTeamMemberSandBoxRequest | KillTeamMemberSandBoxResponse | 0 |
| RecreateTeamMemberSandBox | Unary | RecreateTeamMemberSandBoxRequest | RecreateSandBoxResponse | 0 |
| GetTeamMemberSandBoxMigrationStatus | Unary | GetTeamMemberSandBoxMigrationStatusRequest | GetTeamMemberSandBoxMigrationStatusResponse | 0 |
| StartBulkTeamMemberSandBoxOperation | Unary | StartBulkTeamMemberSandBoxOperationRequest | StartBulkTeamMemberSandBoxOperationResponse | 0 |
| GetBulkTeamMemberSandBoxOperationStatus | Unary | GetBulkTeamMemberSandBoxOperationStatusRequest | GetBulkTeamMemberSandBoxOperationStatusResponse | 0 |
| MintSandVoiceCallSecret | Unary | MintSandVoiceCallSecretRequest | MintSandVoiceCallSecretResponse | 1 |
| BeginOnePasswordConnection | Unary | BeginOnePasswordConnectionRequest | BeginOnePasswordConnectionResponse | 1 |
| CompleteOnePasswordConnection | Unary | CompleteOnePasswordConnectionRequest | OnePasswordState | 1 |
| GetOnePasswordState | Unary | GetOnePasswordStateRequest | OnePasswordState | 1 |
| SyncOnePasswordConnections | Unary | SyncOnePasswordConnectionsRequest | OnePasswordState | 1 |
| DeleteOnePasswordConnection | Unary | DeleteOnePasswordConnectionRequest | OnePasswordState | 1 |
| StartOnePasswordOAuth | Unary | StartOnePasswordOAuthRequest | StartOnePasswordOAuthResponse | 1 |
| StoreOnePasswordIntegrationKey | Unary | StoreOnePasswordIntegrationKeyRequest | StoreOnePasswordIntegrationKeyResponse | 1 |
| CompleteOnePasswordOAuth | Unary | CompleteOnePasswordOAuthRequest | OnePasswordState | 1 |
| ApproveOnePasswordCredentialRequest | Unary | ApproveOnePasswordCredentialRequestRequest | OnePasswordCredentialDecisionResponse | 1 |
| DenyOnePasswordCredentialRequest | Unary | DenyOnePasswordCredentialRequestRequest | OnePasswordCredentialDecisionResponse | 1 |

## Gateway 客户端方法声明

这些方法按已验证的 /api/<method> 传输规则列出；写/审批/管理员操作没有执行。字段类型为静态组合器解析结果，custom/引用的严格约束见人工文档和JSON目录。

| 方法 | 字段 |
| --- | --- |
| getAgentTranscript | id: string |
| getAgentTranscriptPage | id: string; beforeSeq?: number; limit: number; sinceMs?: number; untilMs: number |
| openAgentWindowed | id: string; limit: number |
| getAgentTranscriptWindow | id: string; beforeSeq?: number; limit: number |
| openAgentTail | id: string; limit: number; sessionId?: string; unreadBoundaryAt?: number |
| getAgentTranscriptTail | id: string; beforeSeq?: number; limit: number; sessionId?: string; unreadBoundaryAt?: number |
| getAgentThread | id: string; rootId: string |
| sendPrompt | prompt: string; agentId: string; directAddressedAcceptance?: literal; clientNonce?: string; attachmentPaths?: array; attachmentNames?: array; richText?: string; replyToId?: string; automationWriteProvenance?: union; isFork?: boolean; traceparent?: string; enterEpochMs?: number; composedAtMs?: number; source?: custom; sendSource?: custom; mcpConfigJson?: custom; sessionId?: string; machineId?: string; onePasswordAppInstalled?: boolean; taskId?: string; initiator?: custom |
| promptAcceptanceStatus | accountSlot: string; clientNonce: string; agentId?: string; sessionId?: string |
| respondToWidget | entryId: string; value: string; agentId: string |
| resolveAutoReviewApproval | entryId: string; requestId: string; resolution: custom; agentId: string; approvalPlatform?: custom; approvedCommand?: string; sessionId?: string; meetingJoin?: custom |
| resolveLocalToolPermission | 无参数或未解析schema |
| resolveConnectorGrant | 无参数或未解析schema |
| resolveVirtualCardApproval | entryId: string; requestId: string; resolution: custom; agentId: string; spendRequestId?: string; failureReason?: string; paymentMethodId?: string; attestation?: custom |
| resolveMessagesGrants | requestId: string |
| requestMessagesGrants | requestId: string; grants: array |
| awaitMessagesGrants | requestId: string; waitMs: number |
| cancelMessagesGrants | requestId: string |
| requestCookieOriginApproval | requestId: string; origins: array; agentId?: string |
| awaitCookieOriginApproval | requestId: string; waitMs: number |
| cancelCookieOriginApproval | requestId: string |
| requestWebAuthnCeremony | kind: custom; origin: string; optionsJson: string |
| dismissWidget | entryId: string; agentId: string |
| submitSecret | entryId: string; value: string; agentId: string; sessionId?: string |
| storeSecret | target: union; value: string; agentId: string |
| submitUserForm | entryId: string; values: custom; agentId: string; platform?: custom; saveToVault?: boolean |
| dismissUserForm | entryId: string; mode: custom; agentId: string; platform?: custom |
| sendDraft | entryId: string; draft: custom; agentId: string; sessionId?: string; shownSignatureHtml?: string |
| discardDraft | entryId: string; agentId: string; sessionId?: string |
| reactToMessage | entryId: string; emoji: string; agentId: string |
| voteFeedback | agentId: string; entryId: string; action: custom; categories?: array; comment?: string |
| publishBotTemplate | shareId: string; version: number |
| listBotTemplates | 无参数或未解析schema |
| getBotTemplateVersion | shareId: string; version: number |
| getBotTemplateForSourceAgent | sourceAgentId: string |
| getBotTemplateExportPolicy | 无参数或未解析schema |
| deleteBotTemplate | shareId: string |
| setBotTemplateVisibility | shareId: string; visibility: custom |
| listAgents | 无参数或未解析schema |
| countAgents | 无参数或未解析schema |
| searchAgents | query: string; limit?: number |
| searchMedia | query: string; limit?: number |
| openAgent | id: string |
| createAgent | name: string; description: string; title?: string; avatarShape?: string; avatarColor?: string; avatarPngBase64?: string; creationRoute?: union; origin?: custom; purpose?: custom; isIntroductionSuppressed?: boolean; isKickstartRequested?: boolean; isAutomatic?: boolean; language?: string; templateId?: string; clientNonce?: string; supportsTemporalHarness?: boolean; harness?: union |
| createAgentFromTemplate | shareId: string; agentId: string; name: string; avatarShape: string; avatarColor: string; expectedActiveVersion: number; creatorContext?: string; language?: string; isAutomatic?: boolean; importEntry?: literal |
| createGroup | name: string; description?: string; memberAgentIds: array; humanMemberUserIds?: array; namedBy?: custom; creationRoute?: union; clientNonce?: string |
| setGroupMembers | id: string; memberAgentIds: array; requesterAgentId?: string |
| updateAgent | id: string; profile: custom |
| seedConversationName | id: string; prompt: string |
| deleteAgents | ids: array |
| duplicateAgent | id: string |
| kickstartAgent | id: string |
| interruptAgentRun | id: string; sessionId?: string |
| startFreshConversation | id: string; sessionId?: string |
| rollBackConversation | id: string; sessionId?: string |
| requestDiskSaverAudit | id: string |
| getCloudAgentInfo | bcId: string; includeFiles?: boolean; includeArtifacts?: boolean |
| getCloudAgentConversation | bcId: string |
| ensureCloudAgentArtifacts | agentId: string; bcId: string |
| stopCloudAgent | bcId: string |
| getCloudAgentPublishProposals | bcId: string |
| listCloudAgentPublishedApps | 无参数或未解析schema |
| confirmCloudAgentPublishProposal | agentId: string; bcId: string; proposalId: string; slug: string; visibility?: custom; requireConfirmationForUpdates?: boolean |
| dismissCloudAgentPublishProposal | agentId: string; bcId: string; proposalId: string |
| updateCloudAgentPublishApp | bcId: string; slug: string; apex: string; visibility?: custom; muteRedeployPrompts?: boolean; requireConfirmationForUpdates?: boolean |
| getListenerIntegrations | 无参数或未解析schema |
| getListenerConnectUrl | platform: string; forceOauth?: boolean; oauthRedirectUri: custom |
| disconnectListenerPlatform | platform: string |
| completeGithubConnect | state: string; code?: string; installationId?: string; setupAction?: string; error?: string |
| setAgentUnread | id: string; isUnread: boolean; atMs?: number |
| clearGeneratedRoomNameStamps | rooms: array |
| setAgentHiddenFromSidebar | id: string; isHidden: boolean |
| setAgentNotifyOnUpdates | id: string; isEnabled: boolean |
| setAgentDraftingDisabled | id: string; isDisabled: boolean |
| setAgentVoice | id: string; voiceId?: string or null; voiceSpeed?: number; voiceLanguage?: string |
| previewVoice | voiceId: string; greetingId: string |
| setAgentAvatarBytes | id: string; pngBase64: string or null |
| getAgentAvatar | id: string |
| getAgentNotificationAvatar | id: string |
| getAgentTodos | id: string |
| getAgentWorkflows | id: string |
| createAgentWorkflow | id: string; spec: custom |
| updateAgentWorkflow | id: string; workflowId: string; spec: custom |
| deleteAgentWorkflow | id: string; workflowId: string |
| runAgentWorkflowNow | id: string; workflowId: string |
| importAgentWorkflowText | id: string; markdown: string; name?: string |
| importAgentWorkflowUrl | id: string; url: string; name?: string |
| getConversationOutline | id: string |
| readMainAgentContext | id: string |
| readVoiceCallSentMessages | id: string |
| nudgeVoiceCall | id: string; callId: string; request: string; spokenTurns: array |
| recordVoiceCall | record: custom |
| setVoiceCallPresence | id: string; callId: string; isOnTheLine: boolean; acceptsOverheard?: boolean |
| getVoiceCall | id: string; callId: string |
| skillsCatalog | 无参数或未解析schema |
| syncPluginSkills | 无参数或未解析schema |
| getPluginSyncStatus | 无参数或未解析schema |
| getMcpState | 无参数或未解析schema |
| getMcpCatalog | 无参数或未解析schema |
| getEffectiveMcpPlugins | 无参数或未解析schema |
| getMcpPluginLogo | url: string |
| installMcpEntry | entryId: string; values?: custom; hasTeamConfiguredVariables?: boolean |
| updateMcpPluginInstall | pluginId: string; values: custom |
| removeMcpServer | serverId: string |
| uninstallMcpPlugin | pluginId: string |
| authenticateMcpServer | serverId: string; accountKey?: string; trigger?: literal; forceReauth?: boolean; requestingAgentId?: string; oauthRedirectUri: custom |
| renameMcpAccount | serverId: string; accountKey: string; newAccountKey: string |
| removeMcpAccount | serverId: string; accountKey: string |
| setMcpCustomInstructions | serverId: string; instructions: string |
| listMcpServerTools | serverId: string |
| toggleMcpToolDisabled | serverId: string; toolName: string |
| readMcpAppResource | serverIdentifier: string; resourceUri: string; agentId?: string; entryId?: string; sessionId?: string; documentSha256?: string |
| callMcpAppTool | serverIdentifier: string; toolName: string; argumentsJson: string; userActivated: boolean; agentId?: string |
| transcribeAudio | audioBase64: custom; mimeType: string; language?: string |
| generateAgentAvatarImage | description: string |
| getSkillPublishTargets | 无参数或未解析schema |
| publishSkill | workflowId: string; teamId: number |
| resyncPublishedSkill | workflowId: string |
| unpublishSkill | workflowId: string |
| unpublishPluginListing | pluginId: string; teamId: number |
| hasRestorablePluginListingCopy | pluginId: string |
| getSubagents | id: string |
| getAsyncTasks | id: string |
| getTrays | 无参数或未解析schema |
| dismissTray | id: string |
| clearTrays | 无参数或未解析schema |
| getAgentChannels | id: string |
| connectChannel | id: string; platform: string; token: string |
| disconnectChannel | id: string; platform: string |
| refreshChannel | id: string; platform: string |
| getBoxSecretsStatus | 无参数或未解析schema |
| getAgentAutomations | id: string |
| getAgentTasks | agentId: string |
| markAgentTaskDone | agentId: string; taskId: string |
| markAgentTaskRead | agentId: string; taskId: string; entryId: string |
| getAutomationWebhookCredential | id: string; automationId: string |
| listAllAutomations | 无参数或未解析schema |
| isGlobalSearchEnabled | 无参数或未解析schema |
| isEgressTunnelAvailable | 无参数或未解析schema |
| setAgentAutomationEnabled | id: string; automationId: string; isEnabled: boolean |
| createAgentAutomation | id: string; spec: custom |
| updateAgentAutomation | id: string; automationId: string; spec: custom |
| deleteAgentAutomation | id: string; automationId: string |
| runAgentAutomationNow | id: string; automationId: string; sessionId?: string |
| getForeverBoxStatus | id: string |
| ensureForeverBox | id: string |
| handBackForeverBox | id: string; trigger?: custom; requestId?: string |
| startTeachRecording | agentId: string; entryPoint: custom |
| stopTeachRecording | agentId: string; save: boolean |
| getTeachRecordingStatus | 无参数或未解析schema |
| uploadAttachment | agentId?: string; filename: string; bytesBase64: string |
| uploadAttachmentChunk | agentId?: string; uploadId: string; filename: string; offset: number; totalSize: number; bytesBase64: string |
| readAttachmentImage | path: string; rendition?: union; tile?: custom; fit?: custom |
| readAttachmentText | agentId?: string; path: string |
| readAttachmentChunk | agentId?: string; path: string; offset: number; length: number; videoPlayback?: boolean |
| getHostSettings | 无参数或未解析schema |
| setHostSettings | notifications?: custom; selectedTeam?: custom or null; mcpCustomInstructions?: custom; mcpCustomInstructionsByServerId?: custom; mcpCustomInstructionsAccountScope?: string or null; mcpDisabledToolsByServerId?: record; mcpBoxServers?: array; userTimeZone?: string; osLocale?: string; userTimeZoneOverride?: string; computerUseModel?: custom or null; autoReviewInstructions?: custom; toolPermissions?: custom; localToolPermission?: custom; localToolPermissionMachineId?: string; localToolPermissionByMachineId?: record; webauthnProxyEnabled?: boolean; messagesEnabled?: boolean; pinnedAgentIds?: array; sidebarSections?: array; hasSeenOnboarding?: boolean; featureFlagOverrides?: record; experimentOverrides?: custom |
| setBoxSecrets | secrets: custom |
| carryBoxSecretsToBot | serverId: string; names: array |
| injectChromeCookies | cookies: array |
| refreshMcp | completion?: custom |
| listBoxMcpServers | serverIdentifiers: array |
| completeMcpOAuth | code: string; state: string |
| updateForeverBox | id: string |
| setWindowFocused | isFocused: boolean; surface?: custom |
| getHostStatus | includeManagedCapabilities?: boolean |
| updateHostNow | force?: boolean; includeErrorDetail?: boolean |

## 数量

- 7 个服务描述符，484 个RPC方法。
- 167 个gateway方法声明。
- JSON目录包含请求/响应字段、tag、类型及引用；没有用户账号数据或凭据。
