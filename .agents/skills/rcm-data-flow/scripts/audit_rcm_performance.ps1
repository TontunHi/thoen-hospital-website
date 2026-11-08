# Automated 5-Pillar Performance Audit for all 50 RCM Routes
# Pillars: SSR Prefetch, Double-Fetch Guard, AbortController, Pagination, SWR Cache

$routes = @(
    @{ Name = "opd"; Route = "src/app/service/dashboard-rcm/opd"; Client = "OpdClient.tsx"; Service = "rcmDashboardService.ts"; Api = "src/app/api/service/dashboard-rcm/opd-dept-summary/route.ts" },
    @{ Name = "opd-doctor"; Route = "src/app/service/dashboard-rcm/opd-doctor"; Client = "OpdDoctorClient.tsx"; Service = "rcmDashboardService.ts"; Api = "src/app/api/service/dashboard-rcm/opd-doctor-summary/route.ts" },
    @{ Name = "sss-dental"; Route = "src/app/service/dashboard-rcm/sss-dental"; Client = "SssDentalClient.tsx"; Service = "rcmDashboardService.ts"; Api = "src/app/api/service/dashboard-rcm/sss-dental/route.ts" },
    @{ Name = "ipd"; Route = "src/app/service/dashboard-rcm/ipd"; Client = "IpdClient.tsx"; Service = "rcmDashboardService.ts"; Api = "src/app/api/service/dashboard-rcm/ipd-report/route.ts" },
    @{ Name = "rep-funds"; Route = "src/app/service/dashboard-rcm/rep-funds"; Client = "RepFundsClient.tsx"; Service = "rcmRepFundsService.ts"; Api = "src/app/api/service/dashboard-rcm/rep-funds/route.ts" },
    @{ Name = "invoice-summary"; Route = "src/app/service/dashboard-rcm/invoice-summary"; Client = "InvoiceSummaryClient.tsx"; Service = "rcmDashboardService.ts"; Api = "src/app/api/service/dashboard-rcm/invoice-summary/route.ts" },
    @{ Name = "palliative-pc-1"; Route = "src/app/service/dashboard-rcm/palliative-care/pc-1"; Client = "PalliativeCarePc1Client.tsx"; Service = "rcmDashboardService.ts"; Api = "src/app/api/service/dashboard-rcm/palliative-care/pc-1/route.ts" },
    @{ Name = "palliative-pc-3"; Route = "src/app/service/dashboard-rcm/palliative-care/pc-3"; Client = "PalliativeCareClient.tsx"; Service = "rcmDashboardService.ts"; Api = "src/app/api/service/dashboard-rcm/palliative-care/pc-3/route.ts" },
    @{ Name = "palliative-registry"; Route = "src/app/service/dashboard-rcm/palliative-care/registry"; Client = "PalliativeRegistryClient.tsx"; Service = "palliativeRegistryService.ts"; Api = "src/app/api/service/dashboard-rcm/palliative-care/registry/route.ts" },
    @{ Name = "palliative-ltc-registry"; Route = "src/app/service/dashboard-rcm/palliative-care/ltc-registry"; Client = "LtcRegistryClient.tsx"; Service = "palliativeRegistryService.ts"; Api = "src/app/api/service/dashboard-rcm/palliative-care/ltc-registry/route.ts" },
    @{ Name = "funds/adp-search/adpcode"; Route = "src/app/service/dashboard-rcm/funds/adp-search/adpcode"; Client = "AdpSearchClient.tsx"; Service = "rcmAdpSearchService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/adp-search/route.ts" },
    @{ Name = "funds/amed-homeward/homeward"; Route = "src/app/service/dashboard-rcm/funds/amed-homeward/homeward"; Client = "HomewardReportClient.tsx"; Service = "rcmAmedHomewardService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/amed-homeward/homeward/route.ts" },
    @{ Name = "funds/anc/3"; Route = "src/app/service/dashboard-rcm/funds/anc/3"; Client = "AncService23Client.tsx"; Service = "rcmAncService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/anc/service-2-3/route.ts" },
    @{ Name = "funds/anc/4"; Route = "src/app/service/dashboard-rcm/funds/anc/4"; Client = "AncService30011Client.tsx"; Service = "rcmAncService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/anc/service-30011/route.ts" },
    @{ Name = "funds/anemia-screening/17-1"; Route = "src/app/service/dashboard-rcm/funds/anemia-screening/17-1"; Client = "AnemiaScreening171Client.tsx"; Service = "rcmAnemiaScreeningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/anemia-screening/service-17-1/route.ts" },
    @{ Name = "funds/ccs/2"; Route = "src/app/service/dashboard-rcm/funds/ccs/2"; Client = "CcsScreenedRecipientsClient.tsx"; Service = "rcmCervicalCancerService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/ccs/screened-recipients/route.ts" },
    @{ Name = "funds/ccs/10"; Route = "src/app/service/dashboard-rcm/funds/ccs/10"; Client = "CcsService1B005Client.tsx"; Service = "rcmCervicalCancerService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/ccs/service-1b005/route.ts" },
    @{ Name = "funds/clopidogrel/usage"; Route = "src/app/service/dashboard-rcm/funds/clopidogrel/usage"; Client = "ClopidogrelUsageClient.tsx"; Service = "rcmClopidogrelService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/clopidogrel/usage/route.ts" },
    @{ Name = "funds/colorectal-cancer/21-2"; Route = "src/app/service/dashboard-rcm/funds/colorectal-cancer/21-2"; Client = "ColorectalCancer212Client.tsx"; Service = "rcmColorectalCancerService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/colorectal-cancer/service-21-2/route.ts" },
    @{ Name = "funds/family-planning/1"; Route = "src/app/service/dashboard-rcm/funds/family-planning/1"; Client = "FamilyPlanning91Client.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/service-9-1/route.ts" },
    @{ Name = "funds/family-planning/2"; Route = "src/app/service/dashboard-rcm/funds/family-planning/2"; Client = "FamilyPlanning92Client.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/service-9-2/route.ts" },
    @{ Name = "funds/family-planning/9-3-1-1"; Route = "src/app/service/dashboard-rcm/funds/family-planning/9-3-1-1"; Client = "ImplantInsertionClient.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/implant-insertion/route.ts" },
    @{ Name = "funds/family-planning/9-3-1-2"; Route = "src/app/service/dashboard-rcm/funds/family-planning/9-3-1-2"; Client = "ImplantRemovalClient.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/implant-removal/route.ts" },
    @{ Name = "funds/family-planning/9-3-2"; Route = "src/app/service/dashboard-rcm/funds/family-planning/9-3-2"; Client = "FamilyPlanning932Client.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/service-9-3-2/route.ts" },
    @{ Name = "funds/family-planning/9-4"; Route = "src/app/service/dashboard-rcm/funds/family-planning/9-4"; Client = "OralContraceptivesClient.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/oral-contraceptives/route.ts" },
    @{ Name = "funds/family-planning/9-5"; Route = "src/app/service/dashboard-rcm/funds/family-planning/9-5"; Client = "SingleHormonePillClient.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill/route.ts" },
    @{ Name = "funds/family-planning/9-6"; Route = "src/app/service/dashboard-rcm/funds/family-planning/9-6"; Client = "EmergencyContraceptiveClient.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/emergency-contraceptive/route.ts" },
    @{ Name = "funds/family-planning/9-7"; Route = "src/app/service/dashboard-rcm/funds/family-planning/9-7"; Client = "InjectableContraceptivesClient.tsx"; Service = "rcmFamilyPlanningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/family-planning/injectable-contraceptives/route.ts" },
    @{ Name = "funds/fluoride-varnish/20-1"; Route = "src/app/service/dashboard-rcm/funds/fluoride-varnish/20-1"; Client = "FluorideVarnish201Client.tsx"; Service = "rcmFluorideVarnishService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/fluoride-varnish/service-20-1/route.ts" },
    @{ Name = "funds/health-screening/14-5"; Route = "src/app/service/dashboard-rcm/funds/health-screening/14-5"; Client = "FastingPlasmaGlucoseClient.tsx"; Service = "rcmHealthScreeningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/health-screening/service-14-5/route.ts" },
    @{ Name = "funds/health-screening/14-6"; Route = "src/app/service/dashboard-rcm/funds/health-screening/14-6"; Client = "TotalCholesterolClient.tsx"; Service = "rcmHealthScreeningService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/health-screening/service-14-6/route.ts" },
    @{ Name = "funds/hepatitis-c/23-2"; Route = "src/app/service/dashboard-rcm/funds/hepatitis-c/23-2"; Client = "HepatitisC232Client.tsx"; Service = "rcmHepatitisCService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/hepatitis-c/service-23-2/route.ts" },
    @{ Name = "funds/hepatitis-c/23-4"; Route = "src/app/service/dashboard-rcm/funds/hepatitis-c/23-4"; Client = "HepatitisC234Client.tsx"; Service = "rcmHepatitisCService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/hepatitis-c/service-23-4/route.ts" },
    @{ Name = "funds/iron-supplements/18-2"; Route = "src/app/service/dashboard-rcm/funds/iron-supplements/18-2"; Client = "IronSupplements182Client.tsx"; Service = "rcmIronSupplementsService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/iron-supplements/service-18-2/route.ts" },
    @{ Name = "funds/oral-cancer/1"; Route = "src/app/service/dashboard-rcm/funds/oral-cancer/1"; Client = "OralCancerScreeningClient.tsx"; Service = "rcmOralCancerService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/oral-cancer/1/route.ts" },
    @{ Name = "funds/postpartum/2"; Route = "src/app/service/dashboard-rcm/funds/postpartum/2"; Client = "PostpartumService72Client.tsx"; Service = "rcmPostpartumService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/postpartum/service-7-2/route.ts" },
    @{ Name = "funds/postpartum/3"; Route = "src/app/service/dashboard-rcm/funds/postpartum/3"; Client = "PostpartumService30016Client.tsx"; Service = "rcmPostpartumService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/postpartum/service-30016/route.ts" },
    @{ Name = "funds/pregnancy-test/1"; Route = "src/app/service/dashboard-rcm/funds/pregnancy-test/1"; Client = "PregnancyTestClient.tsx"; Service = "rcmPregnancyTestService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/pregnancy-test/service-1/route.ts" },
    @{ Name = "funds/rehabilitation/services/disability-services"; Route = "src/app/service/dashboard-rcm/funds/rehabilitation/services/disability-services"; Client = "DisabilityServicesClient.tsx"; Service = "rcmRehabilitationService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/rehabilitation/services/disability-services/route.ts" },
    @{ Name = "funds/streptokinase/recipients"; Route = "src/app/service/dashboard-rcm/funds/streptokinase/recipients"; Client = "StreptokinaseRecipientsClient.tsx"; Service = "rcmStreptokinaseService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/streptokinase/recipients/route.ts" },
    @{ Name = "funds/t1dm-gdm-pdm/2"; Route = "src/app/service/dashboard-rcm/funds/t1dm-gdm-pdm/2"; Client = "T1dmGdmPdm2Client.tsx"; Service = "rcmT1dmGdmPdmService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/t1dm-gdm-pdm/service-recipients/route.ts" },
    @{ Name = "funds/telemed-drug/postal-drug"; Route = "src/app/service/dashboard-rcm/funds/telemed-drug/postal-drug"; Client = "PostalDrugClient.tsx"; Service = "rcmTelemedDrugService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/telemed-drug/postal-drug/route.ts" },
    @{ Name = "funds/telemed-drug/telemed"; Route = "src/app/service/dashboard-rcm/funds/telemed-drug/telemed"; Client = "TelemedClient.tsx"; Service = "rcmTelemedDrugService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/telemed-drug/telemed/route.ts" },
    @{ Name = "funds/thai-traditional-medicine/3"; Route = "src/app/service/dashboard-rcm/funds/thai-traditional-medicine/3"; Client = "ThaiTraditionalMedicine3Client.tsx"; Service = "rcmThaiTraditionalMedicineService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/thai-traditional-medicine/3/route.ts" },
    @{ Name = "funds/thai-traditional-medicine/11"; Route = "src/app/service/dashboard-rcm/funds/thai-traditional-medicine/11"; Client = "ThaiTraditionalMedicine11Client.tsx"; Service = "rcmThaiTraditionalMedicineService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/thai-traditional-medicine/11/route.ts" },
    @{ Name = "funds/thalassemia/1"; Route = "src/app/service/dashboard-rcm/funds/thalassemia/1"; Client = "ThalassemiaService31Client.tsx"; Service = "rcmThalassemiaService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/thalassemia/service-31/route.ts" },
    @{ Name = "funds/thalassemia-fund/opd"; Route = "src/app/service/dashboard-rcm/funds/thalassemia-fund/opd"; Client = "ThalassemiaOpdClient.tsx"; Service = "rcmThalassemiaFundService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/thalassemia-fund/opd/route.ts" },
    @{ Name = "funds/thalassemia-fund/ipd"; Route = "src/app/service/dashboard-rcm/funds/thalassemia-fund/ipd"; Client = "ThalassemiaIpdClient.tsx"; Service = "rcmThalassemiaFundService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/thalassemia-fund/ipd/route.ts" },
    @{ Name = "funds/viral-hepatitis/23-1"; Route = "src/app/service/dashboard-rcm/funds/viral-hepatitis/23-1"; Client = "ViralHepatitis231Client.tsx"; Service = "rcmViralHepatitisService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/viral-hepatitis/service-23-1/route.ts" },
    @{ Name = "funds/instrument"; Route = "src/app/service/dashboard-rcm/funds/instrument"; Client = "InstrumentFundClient.tsx"; Service = "rcmInstrumentFundService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/instrument/route.ts" },
    @{ Name = "funds/rehabilitation/imc/eligible-patients"; Route = "src/app/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients"; Client = "ImcEligiblePatientsClient.tsx"; Service = "rcmImcService.ts"; Api = "src/app/api/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients/route.ts" }
)

$detailedResults = @()

foreach ($r in $routes) {
    $pagePath = Join-Path $r.Route "page.tsx"
    $clientPath = Join-Path $r.Route $r.Client
    $servicePath = Join-Path "src/lib/clinical" $r.Service

    $pageExists = Test-Path $pagePath
    $clientExists = Test-Path $clientPath
    $serviceExists = Test-Path $servicePath

    $ssrPrefetch = $false
    if ($pageExists) {
        $pageCode = Get-Content -Path $pagePath -Raw
        $ssrPrefetch = ($pageCode -match "initialData\s*=") -or ($pageCode -match "await\s+[A-Za-z0-9_.]+(Report|Summary|Items)")
    }

    $hasAbort = $false
    $hasDoubleFetchGuard = $false
    if ($clientExists) {
        $clientCode = Get-Content -Path $clientPath -Raw
        $hasAbort = $clientCode -match "AbortController"
        $hasDoubleFetchGuard = ($clientCode -match "initialQueryKeyRef") -or ($clientCode -match "isFirstMount") -or ($clientCode -match "isInitialMount") -or ($clientCode -match "isMountedRef") -or ($clientCode -match "skipInitial") -or ($clientCode -match "if\s*\(initialData\)\s*return")
        
        if (-not $hasAbort -and ($clientCode -match "FamilyPlanningReportClient")) {
            $baseClientPath = "src/app/service/dashboard-rcm/funds/family-planning/FamilyPlanningReportClient.tsx"
            if (Test-Path $baseClientPath) {
                $baseCode = Get-Content -Path $baseClientPath -Raw
                $hasAbort = $baseCode -match "AbortController"
                $hasDoubleFetchGuard = $baseCode -match "isFirstMount"
            }
        }
    }

    $hasServerPagination = $false
    $hasCache = $false
    if ($serviceExists) {
        $serviceCode = Get-Content -Path $servicePath -Raw
        $hasCache = ($serviceCode -match "getCachedData") -or ($serviceCode -match "getSwrCachedData")
        $hasServerPagination = ($serviceCode -match "pageSize") -or ($serviceCode -match "OFFSET") -or ($serviceCode -match "LIMIT") -or ($serviceCode -match "slice\(")
    }

    $passSsr = $ssrPrefetch -and $hasDoubleFetchGuard
    $passClient = $hasAbort
    $passBackend = $hasServerPagination -and $hasCache

    $overallPass = $passSsr -and $passClient -and $passBackend

    $detailedResults += [PSCustomObject]@{
        Name = $r.Name
        Overall = if ($overallPass) { "PASS" } else { "FAIL" }
        SSR = if ($ssrPrefetch) { "YES" } else { "NO" }
        MountGuard = if ($hasDoubleFetchGuard) { "YES" } else { "NO" }
        AbortCtrl = if ($hasAbort) { "YES" } else { "NO" }
        Paginated = if ($hasServerPagination) { "YES" } else { "NO" }
        Cached = if ($hasCache) { "YES" } else { "NO" }
    }
}

$detailedResults | Format-Table -AutoSize
Write-Host "Total Audited Routes: $($detailedResults.Count)"
Write-Host "Total Passed: $(($detailedResults | Where-Object { $_.Overall -eq 'PASS' }).Count)"
Write-Host "Total Failed: $(($detailedResults | Where-Object { $_.Overall -eq 'FAIL' }).Count)"
