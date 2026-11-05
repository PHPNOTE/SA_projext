package com.garage.controller;

import com.garage.dto.ReportDtos.*;
import com.garage.service.ReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping({"/admin/reports/repair-summary", "/reports/repair-summary"})
    public ResponseEntity<RepairSummaryReport> getRepairSummary(
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) Long mechanicId
    ) {
        return ResponseEntity.ok(reportService.getRepairSummary(startDate, endDate, mechanicId));
    }

    @GetMapping({"/admin/reports/inventory-usage", "/reports/inventory-usage"})
    public ResponseEntity<InventoryUsageReport> getInventoryUsage(
        @RequestParam(required = false) String category
    ) {
        return ResponseEntity.ok(reportService.getInventoryUsage(category));
    }

    @GetMapping({"/admin/reports/revenue", "/reports/revenue"})
    public ResponseEntity<RevenueReport> getRevenueReport(
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate
    ) {
        return ResponseEntity.ok(reportService.getRevenueReport(startDate, endDate));
    }
}
