package com.garage;

import com.garage.dto.RepairDtos.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Queue & Repair Order Workflow REST Integration Tests (R1, R2)")
public class QueueAndRepairControllerIntegrationTest extends BaseControllerIntegrationTest {

    @Test
    @DisplayName("Walk-in check-in creates QUEUED ticket with ticket_no and bay_id null")
    void testCheckinNormalSuccess() throws Exception {
        RegisterRepairRequest req = new RegisterRepairRequest(
            "คุณวิทวัส เจริญกิจ", "089-999-1122", "เช็คระยะ 50,000 กม.",
            "7ฮฮ-7788 กรุงเทพมหานคร", "Toyota", "Corolla Cross", 2023,
            "ตรวจเช็คทั่วไป", "NORMAL", null, null,
            null, null, false, null
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("QUEUED"))
            .andExpect(jsonPath("$.ticketNo", startsWith("TICK-")))
            .andExpect(jsonPath("$.bayId").doesNotExist());
    }

    @Test
    @DisplayName("Priority check-in with mandatory priorityReason succeeds")
    void testCheckinPrioritySuccess() throws Exception {
        RegisterRepairRequest req = new RegisterRepairRequest(
            "คุณสมหมาย ด่วนจี๋", "081-333-4455", "งานด่วน",
            "9กข-9900 กรุงเทพมหานคร", "Honda", "City", 2022,
            "เครื่องยนต์สะดุด ต้องเดินทางต่างจังหวัด", "PRIORITY", "ลูกค้าเดินทางด่วน", null,
            null, null, false, null
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("QUEUED"))
            .andExpect(jsonPath("$.queueClass").value("PRIORITY"))
            .andExpect(jsonPath("$.priorityReason").value("ลูกค้าเดินทางด่วน"));
    }

    @Test
    @DisplayName("Priority check-in with blank priorityReason is rejected with HTTP 400 VALIDATION_ERROR")
    void testCheckinPriorityMissingReason() throws Exception {
        RegisterRepairRequest req = new RegisterRepairRequest(
            "คุณสมหมาย ด่วนจี๋", "081-333-4455", null,
            "8กข-8800 กรุงเทพมหานคร", "Honda", "City", 2022,
            "เครื่องยนต์สะดุด", "PRIORITY", "   ", null,
            null, null, false, null
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Call next assigns free bay & mechanic and moves ticket to IN_DIAGNOSIS")
    void testCallNextSuccess() throws Exception {
        // Register ticket
        RegisterRepairRequest req = new RegisterRepairRequest(
            "คุณประภาส พัฒนา", "082-444-5566", null,
            "5ชช-5511 กรุงเทพมหานคร", "Mazda", "CX-5", 2021,
            "แอร์ไม่เย็น", "NORMAL", null, null,
            null, null, false, null
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk());

        // Bay 1 and Mechanic 3 (Somchai)
        CallNextRequest callReq = new CallNextRequest(1L, 3L);

        mockMvc.perform(post("/api/queue/call-next")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(callReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bayId").value(1))
            .andExpect(jsonPath("$.mechanicId").value(3))
            .andExpect(jsonPath("$.status").value("IN_DIAGNOSIS"));
    }

    @Test
    @DisplayName("Call next to an already occupied bay throws HTTP 409 NO_FREE_BAY")
    void testCallNextOccupiedBayThrows() throws Exception {
        // Bay 3 is already occupied in seed data (RO 3 is IN_REPAIR)
        CallNextRequest callReq = new CallNextRequest(3L, 3L);

        mockMvc.perform(post("/api/queue/call-next")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(callReq)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("NO_FREE_BAY"));
    }

    @Test
    @DisplayName("Hold repair order releases bay and sets status to ON_HOLD")
    void testHoldRepairReleasesBay() throws Exception {
        HoldRepairRequest holdReq = new HoldRepairRequest("รออะไหล่จากศูนย์");

        // RO 5 is IN_DIAGNOSIS on Bay 4 in seed data
        mockMvc.perform(post("/api/repairs/5/hold")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(holdReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ON_HOLD"))
            .andExpect(jsonPath("$.bayId").doesNotExist())
            .andExpect(jsonPath("$.holdReason").value("รออะไหล่จากศูนย์"));
    }

    @Test
    @DisplayName("Cancel repair order releases bay and transitions to CANCELLED")
    void testCancelRepairReleasesBay() throws Exception {
        CancelRepairRequest cancelReq = new CancelRepairRequest("ลูกค้ายกเลิกงานซ่อม");

        mockMvc.perform(post("/api/repairs/5/cancel")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(cancelReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"))
            .andExpect(jsonPath("$.bayId").doesNotExist());
    }

    @Test
    @DisplayName("Manager can override priority class; Non-manager receives HTTP 403 ACCESS_DENIED")
    void testPriorityOverrideRbac() throws Exception {
        PriorityOverrideRequest overrideReq = new PriorityOverrideRequest("ผู้บริหารระดับสูงมาใช้บริการ");

        // Non-manager (Front Desk) attempts override -> 403
        mockMvc.perform(post("/api/repairs/6/priority-override")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(overrideReq)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // Manager attempts override -> 200
        mockMvc.perform(post("/api/repairs/6/priority-override")
                .header("Authorization", getManagerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(overrideReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.queueClass").value("PRIORITY"))
            .andExpect(jsonPath("$.priorityReason").value("ผู้บริหารระดับสูงมาใช้บริการ"));
    }
}
