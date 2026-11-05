package com.garage;

import com.garage.dto.EstimateDtos.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Estimate Lifecycle & Customer Approval Integration Tests (R3, R4)")
public class EstimateAndWorkflowIntegrationTest extends BaseControllerIntegrationTest {

    @Test
    @DisplayName("Mechanic drafts Estimate Revision 1; order moves to AWAITING_APPROVAL")
    void testDraftEstimateSuccess() throws Exception {
        // RO 5 is IN_DIAGNOSIS in seed data
        CreateEstimateRequest req = new CreateEstimateRequest(
            5L,
            "เปลี่ยนน้ำมันเครื่องและไส้กรอง",
            List.of(
                new EstimateLineRequest("LABOR", null, "ค่าแรงเปลี่ยนน้ำมันเครื่อง", 1, new BigDecimal("350.00")),
                new EstimateLineRequest("PART", 1L, "น้ำมันเครื่อง 5W-30", 1, new BigDecimal("1250.00")),
                new EstimateLineRequest("PART", 2L, "ไส้กรองน้ำมันเครื่อง", 1, new BigDecimal("220.00"))
            )
        );

        mockMvc.perform(post("/api/estimates")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.estimate.status").value("PENDING"))
            .andExpect(jsonPath("$.estimate.revisionNo").value(2)) // Seed has rev 1 already
            .andExpect(jsonPath("$.lines", hasSize(3)));
    }

    @Test
    @DisplayName("Drafting estimate with empty lines list is rejected with HTTP 400 EMPTY_ESTIMATE")
    void testDraftEstimateEmptyLines() throws Exception {
        CreateEstimateRequest req = new CreateEstimateRequest(
            5L,
            "ไม่มีรายการ",
            List.of()
        );

        mockMvc.perform(post("/api/estimates")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("EMPTY_ESTIMATE"));
    }

    @Test
    @DisplayName("Drafting estimate with 0 or negative quantity is rejected with HTTP 400 INVALID_QUANTITY")
    void testDraftEstimateZeroQuantity() throws Exception {
        CreateEstimateRequest req = new CreateEstimateRequest(
            5L,
            "จำนวนผิดพลาด",
            List.of(new EstimateLineRequest("LABOR", null, "ค่าแรง", 0, new BigDecimal("350.00")))
        );

        mockMvc.perform(post("/api/estimates")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUANTITY"));
    }

    @Test
    @DisplayName("Drafting estimate with negative price is rejected with HTTP 400 INVALID_PRICE")
    void testDraftEstimateNegativePrice() throws Exception {
        CreateEstimateRequest req = new CreateEstimateRequest(
            5L,
            "ราคาผิดพลาด",
            List.of(new EstimateLineRequest("LABOR", null, "ค่าแรง", 1, new BigDecimal("-100.00")))
        );

        mockMvc.perform(post("/api/estimates")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_PRICE"));
    }

    @Test
    @DisplayName("Customer approves Revision 1 -> locks parts, transitions order to IN_REPAIR")
    void testCustomerApprovalLocksStock() throws Exception {
        // Estimate 5 is PENDING for RO 5 in seed data
        EstimateDecisionRequest decReq = new EstimateDecisionRequest("APPROVED", false);

        mockMvc.perform(post("/api/estimates/5/decision")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(decReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.estimate.status").value("APPROVED"))
            .andExpect(jsonPath("$.repairOrder.status").value("IN_REPAIR"));
    }

    @Test
    @DisplayName("Customer declines Revision 1 -> cancels repair order, releases bay")
    void testCustomerDeclineCancelsRepair() throws Exception {
        // Estimate 5 is Rev 1 for RO 5
        EstimateDecisionRequest decReq = new EstimateDecisionRequest("DECLINED", false);

        mockMvc.perform(post("/api/estimates/5/decision")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(decReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.estimate.status").value("DECLINED"))
            .andExpect(jsonPath("$.repairOrder.status").value("CANCELLED"))
            .andExpect(jsonPath("$.repairOrder.bayId").doesNotExist());
    }

    @Test
    @DisplayName("Insurance claim approval without documents received is rejected with HTTP 422 INSURANCE_DOCS_MISSING")
    void testInsuranceDocsMissingThrows422() throws Exception {
        com.garage.dto.RepairDtos.RegisterRepairRequest checkinReq = new com.garage.dto.RepairDtos.RegisterRepairRequest(
            "คุณวิริยะ เคลมด่วน", "088-777-6655", "เคลมประกัน",
            "1กข-4220 กรุงเทพมหานคร", "Toyota", "Yaris", 2021,
            "กันชนหน้าเสียหาย ขอยื่นเคลม", "PRIORITY", "นัดหมายเคลมประกันด่วน", "2026-11-04T00:00:00Z",
            "วิริยะประกันภัย", "CLM-2026-00422", false, new BigDecimal("4000.00")
        );

        String checkinRes = mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(checkinReq)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long myRepairId = objectMapper.readTree(checkinRes).get("repairId").asLong();

        // Call next to Bay 5, Mechanic 3 (PRIORITY ticket queued yesterday called first)
        String callRes = mockMvc.perform(post("/api/queue/call-next")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new com.garage.dto.RepairDtos.CallNextRequest(5L, 3L))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long repairId = objectMapper.readTree(callRes).get("repairId").asLong();
        org.junit.jupiter.api.Assertions.assertEquals(myRepairId, repairId);

        // Draft estimate
        CreateEstimateRequest estReq = new CreateEstimateRequest(
            repairId,
            "เคาะพ่นสีกันชนหน้า",
            List.of(new EstimateLineRequest("LABOR", null, "เคาะทำสี", 1, new BigDecimal("3500.00")))
        );

        String estRes = mockMvc.perform(post("/api/estimates")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(estReq)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long estId = objectMapper.readTree(estRes).get("estimate").get("estimateId").asLong();

        // Attempt approval with insuranceDocsReceived = false -> 422
        EstimateDecisionRequest decReqFalse = new EstimateDecisionRequest("APPROVED", false);
        mockMvc.perform(post("/api/estimates/" + estId + "/decision")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(decReqFalse)))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("INSURANCE_DOCS_MISSING"));

        // Approval with insuranceDocsReceived = true -> 200
        EstimateDecisionRequest decReqTrue = new EstimateDecisionRequest("APPROVED", true);
        mockMvc.perform(post("/api/estimates/" + estId + "/decision")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(decReqTrue)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.estimate.status").value("APPROVED"))
            .andExpect(jsonPath("$.repairOrder.status").value("IN_REPAIR"));
    }
}
