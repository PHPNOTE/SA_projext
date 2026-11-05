package com.garage;

import com.garage.dto.WarehouseDtos.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.util.List;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Warehouse, Parts & Inventory Ledger Integration Tests (W1-W7)")
public class WarehouseAndInventoryIntegrationTest extends BaseControllerIntegrationTest {

    @Test
    @DisplayName("Upsert new part creates part master record with HTTP 201 Created")
    void testUpsertNewPartCreated() throws Exception {
        PartUpsertRequest req = new PartUpsertRequest(
            "BAT-12V-GS01",
            "แบตเตอรี่ GS Maintenance Free 12V 45Ah",
            new BigDecimal("2200.00"),
            3
        );

        mockMvc.perform(post("/api/warehouse/parts")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.sku").value("BAT-12V-GS01"))
            .andExpect(jsonPath("$.sellPrice").value(2200.00))
            .andExpect(jsonPath("$.reorderLevel").value(3))
            .andExpect(jsonPath("$.onHand").value(0))
            .andExpect(jsonPath("$.reserved").value(0));
    }

    @Test
    @DisplayName("Upsert existing part updates record and returns HTTP 200 OK")
    void testUpsertExistingPartUpdated() throws Exception {
        // Part 1 exists in seed data
        PartUpsertRequest req = new PartUpsertRequest(
            "OIL-SYN-5W30",
            "น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4 ลิตร) - ปรับราคา",
            new BigDecimal("1300.00"),
            12
        );

        mockMvc.perform(post("/api/warehouse/parts")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sku").value("OIL-SYN-5W30"))
            .andExpect(jsonPath("$.sellPrice").value(1300.00))
            .andExpect(jsonPath("$.reorderLevel").value(12));
    }

    @Test
    @DisplayName("Upsert part with negative sell price is rejected with HTTP 400 INVALID_PRICE")
    void testUpsertPartNegativePrice() throws Exception {
        PartUpsertRequest req = new PartUpsertRequest(
            "BAD-PRICE-PART",
            "อะไหล่ราคาติดลบ",
            new BigDecimal("-50.00"),
            2
        );

        mockMvc.perform(post("/api/warehouse/parts")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_PRICE"));
    }

    @Test
    @DisplayName("Issue reserved part decrements stock counters and transitions request to ISSUED")
    void testIssueReservedPartSuccess() throws Exception {
        // In seed data: PartRequest 8 is RESERVED for Part 5 (qty=1, on_hand=10, reserved=2)
        IssuePartRequest req = new IssuePartRequest(8L);

        mockMvc.perform(post("/api/warehouse/issue")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.partRequest.status").value("ISSUED"))
            .andExpect(jsonPath("$.partRequest.qtyIssued").value(1))
            .andExpect(jsonPath("$.part.onHand").value(9))
            .andExpect(jsonPath("$.part.reserved").value(1));
    }

    @Test
    @DisplayName("Attempting to issue an unreserved part request throws HTTP 409 PART_NOT_RESERVED")
    void testIssueUnreservedPartThrows() throws Exception {
        // In seed data: PartRequest 9 is BACKORDERED
        IssuePartRequest req = new IssuePartRequest(9L);

        mockMvc.perform(post("/api/warehouse/issue")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PART_NOT_RESERVED"));
    }

    @Test
    @DisplayName("Return unused part increments onHand and records qtyReturned")
    void testReturnIssuedPartSuccess() throws Exception {
        // In seed data: PartRequest 1 is already ISSUED for Part 1 (qty=1, qtyIssued=1, qtyReturned=0)
        // Return 1 unit
        ReturnPartRequest returnReq = new ReturnPartRequest(1L, 1);

        mockMvc.perform(post("/api/warehouse/return")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(returnReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.partRequest.qtyReturned").value(1))
            .andExpect(jsonPath("$.part.onHand").value(22)); // 21 + 1 = 22
    }

    @Test
    @DisplayName("Over-return of parts is rejected with HTTP 409 INVALID_RETURN_QTY")
    void testOverReturnThrows() throws Exception {
        // PartRequest 1 has qtyIssued = 1, qtyReturned = 0. Returning 5 units exceeds max returnable.
        ReturnPartRequest returnReq = new ReturnPartRequest(1L, 5);

        mockMvc.perform(post("/api/warehouse/return")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(returnReq)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INVALID_RETURN_QTY"));
    }

    @Test
    @DisplayName("Create Purchase Order saves PO and lines in ORDERED status")
    void testCreatePOSuccess() throws Exception {
        CreatePORequest poReq = new CreatePORequest(
            "บริษัท สยามอะไหล่ยนต์ จำกัด",
            "2026-11-20",
            List.of(
                new POLineRequest(1L, 10, new BigDecimal("800.00")),
                new POLineRequest(2L, 20, new BigDecimal("150.00"))
            )
        );

        mockMvc.perform(post("/api/warehouse/pos")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(poReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.purchaseOrder.status").value("ORDERED"))
            .andExpect(jsonPath("$.purchaseOrder.supplierName").value("บริษัท สยามอะไหล่ยนต์ จำกัด"))
            .andExpect(jsonPath("$.lines").isArray());
    }

    @Test
    @DisplayName("Physical stock count adjustment with valid reason succeeds")
    void testStockAdjustSuccess() throws Exception {
        // Part 2 has onHand=27, reserved=0. Adjust +3
        StockAdjustRequest adjustReq = new StockAdjustRequest(2L, 3, "ตรวจนับสต็อกประจำสัปดาห์ เกินมา 3 อัน");

        mockMvc.perform(post("/api/warehouse/adjust")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(adjustReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.onHand").value(30));
    }

    @Test
    @DisplayName("Stock adjustment reducing count below active reservations throws HTTP 409 INVALID_STOCK")
    void testStockAdjustBelowReservedThrows() throws Exception {
        // Part 5 has onHand=10, reserved=2. Adjusting -9 would make onHand=1 < reserved(2)
        StockAdjustRequest adjustReq = new StockAdjustRequest(5L, -9, "สต็อกสูญหาย");

        mockMvc.perform(post("/api/warehouse/adjust")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(adjustReq)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INVALID_STOCK"));
    }

    @Test
    @DisplayName("Stock adjustment with blank reason is rejected with HTTP 400 VALIDATION_ERROR")
    void testStockAdjustBlankReasonThrows() throws Exception {
        StockAdjustRequest adjustReq = new StockAdjustRequest(1L, -2, "   ");

        mockMvc.perform(post("/api/warehouse/adjust")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(adjustReq)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Query stock movement ledger and low stock alert list")
    void testGetLedgerAndLowStock() throws Exception {
        mockMvc.perform(get("/api/warehouse/ledger")
                .header("Authorization", getWarehouseToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(5)));

        mockMvc.perform(get("/api/warehouse/low-stock")
                .header("Authorization", getWarehouseToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }
}
