package com.garage;

import com.garage.dto.EstimateDtos.*;
import com.garage.dto.InvoiceDtos.*;
import com.garage.dto.RepairDtos.*;
import com.garage.dto.WarehouseDtos.IssuePartRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.util.List;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Invoicing, QC Bay Release & Payment Settlement Tests (R5, R6)")
public class InvoiceAndBillingIntegrationTest extends BaseControllerIntegrationTest {

    private Long createRepairInRepairWithParts(boolean issueParts) throws Exception {
        RegisterRepairRequest checkin = new RegisterRepairRequest(
            "ลูกค้าทดสอบระบบ", "081-999-8888", "ทดสอบทั่วไป",
            "9กก-9999", "Toyota", "Corolla", 2020,
            "เปลี่ยนน้ำมันเครื่อง", "PRIORITY", "นัดหมายเร่งด่วน", "2026-11-04T00:00:00Z",
            null, null, false, BigDecimal.ZERO
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(checkin)))
            .andExpect(status().isOk());

        // Call next to Bay 6, Mechanic 3 (PRIORITY ticket queued earlier called first)
        String callRes = mockMvc.perform(post("/api/queue/call-next")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CallNextRequest(6L, 3L))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long repairId = objectMapper.readTree(callRes).get("repairId").asLong();

        // Draft estimate: 1 part (Part 1, qty 1, 1250) + 1 labor (500) = 1750
        CreateEstimateRequest estReq = new CreateEstimateRequest(
            repairId,
            "เช็คระยะ",
            List.of(
                new EstimateLineRequest("PART", 1L, "น้ำมันเครื่อง", 1, new BigDecimal("1250.00")),
                new EstimateLineRequest("LABOR", null, "ค่าแรง", 1, new BigDecimal("500.00"))
            )
        );

        String estRes = mockMvc.perform(post("/api/estimates")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(estReq)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long estId = objectMapper.readTree(estRes).get("estimate").get("estimateId").asLong();

        // Customer approves estimate -> moves to IN_REPAIR and creates PartRequest(s) in RESERVED status
        mockMvc.perform(post("/api/estimates/" + estId + "/decision")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EstimateDecisionRequest("APPROVED", false))))
            .andExpect(status().isOk());

        if (issueParts) {
            // Find part requests created for this estimate
            List<Long> requestIds = jdbcTemplate.queryForList(
                "SELECT pr.request_id FROM part_request pr " +
                "JOIN estimate_line el ON pr.estimate_line_id = el.line_id " +
                "WHERE el.estimate_id = ?",
                Long.class,
                estId
            );
            for (Long reqId : requestIds) {
                mockMvc.perform(post("/api/warehouse/issue")
                        .header("Authorization", getWarehouseToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new IssuePartRequest(reqId))))
                    .andExpect(status().isOk());
            }
        }

        return repairId;
    }

    @Test
    @DisplayName("Submit QC pass when all parts are issued moves order to AWAITING_PAYMENT and releases bay")
    void testQCPassReleasesBay() throws Exception {
        Long repairId = createRepairInRepairWithParts(true);

        // Submit QC pass
        QCRequest qcReq = new QCRequest(true);

        mockMvc.perform(post("/api/repairs/" + repairId + "/qc")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(qcReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("AWAITING_PAYMENT"))
            .andExpect(jsonPath("$.bayId").doesNotExist());
    }

    @Test
    @DisplayName("Submit QC blocked with HTTP 409 PENDING_PART_REQUEST when any part is still RESERVED")
    void testQCBlockedIfPartNotIssued() throws Exception {
        Long repairId = createRepairInRepairWithParts(false);

        // Submit QC without issuing reserved parts
        QCRequest qcReq = new QCRequest(true);

        mockMvc.perform(post("/api/repairs/" + repairId + "/qc")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(qcReq)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PENDING_PART_REQUEST"));
    }

    @Test
    @DisplayName("Generate immutable invoice with net-issued parts formula")
    void testGenerateInvoiceSuccess() throws Exception {
        Long repairId = createRepairInRepairWithParts(true);

        // Complete QC
        mockMvc.perform(post("/api/repairs/" + repairId + "/qc")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new QCRequest(true))))
            .andExpect(status().isOk());

        GenerateInvoiceRequest req = new GenerateInvoiceRequest(repairId, null);

        mockMvc.perform(post("/api/invoices")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.invoice.status").value("ISSUED"))
            .andExpect(jsonPath("$.invoice.invoiceNo", startsWith("INV-")))
            .andExpect(jsonPath("$.invoice.subtotal").value(1750.00))
            .andExpect(jsonPath("$.invoice.customerDue").value(1750.00));
    }

    @Test
    @DisplayName("Attempting to generate duplicate active invoice throws HTTP 409 DUPLICATE_INVOICE")
    void testDuplicateInvoiceThrows() throws Exception {
        Long repairId = createRepairInRepairWithParts(true);

        mockMvc.perform(post("/api/repairs/" + repairId + "/qc")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new QCRequest(true))))
            .andExpect(status().isOk());

        GenerateInvoiceRequest req = new GenerateInvoiceRequest(repairId, null);

        // First generation succeeds
        mockMvc.perform(post("/api/invoices")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk());

        // Second generation throws
        mockMvc.perform(post("/api/invoices")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("DUPLICATE_INVOICE"));
    }

    @Test
    @DisplayName("Customer payment in full transitions repair order to COMPLETED and populates closed_at")
    void testFullCustomerPaymentCompletesRepair() throws Exception {
        Long repairId = createRepairInRepairWithParts(true);

        mockMvc.perform(post("/api/repairs/" + repairId + "/qc")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new QCRequest(true))))
            .andExpect(status().isOk());

        String invRes = mockMvc.perform(post("/api/invoices")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new GenerateInvoiceRequest(repairId, null))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long invoiceId = objectMapper.readTree(invRes).get("invoice").get("invoiceId").asLong();

        // Pay customer due in full (1750.00)
        PayInvoiceRequest payReq = new PayInvoiceRequest(new BigDecimal("1750.00"), "CUSTOMER", "TRANSFER");

        mockMvc.perform(post("/api/invoices/" + invoiceId + "/pay")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.repairStatus").value("COMPLETED"))
            .andExpect(jsonPath("$.totalCustomerPaid").value(1750.00));
    }

    @Test
    @DisplayName("Partial customer payment leaves repair order in AWAITING_PAYMENT")
    void testPartialPaymentLeavesAwaitingPayment() throws Exception {
        Long repairId = createRepairInRepairWithParts(true);

        mockMvc.perform(post("/api/repairs/" + repairId + "/qc")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new QCRequest(true))))
            .andExpect(status().isOk());

        String invRes = mockMvc.perform(post("/api/invoices")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new GenerateInvoiceRequest(repairId, null))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long invoiceId = objectMapper.readTree(invRes).get("invoice").get("invoiceId").asLong();

        // Customer pays 1000 (due 1750)
        PayInvoiceRequest partialPay = new PayInvoiceRequest(new BigDecimal("1000.00"), "CUSTOMER", "CASH");

        mockMvc.perform(post("/api/invoices/" + invoiceId + "/pay")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(partialPay)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.repairStatus").value("AWAITING_PAYMENT"))
            .andExpect(jsonPath("$.totalCustomerPaid").value(1000.00));
    }
}
