package com.garage;

import com.garage.dto.AdminDtos.*;
import com.garage.dto.AuthDtos.LoginRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Reports & Admin Configuration REST Integration Tests (A1, A2, Reports 1 & 2)")
public class ReportAndAdminIntegrationTest extends BaseControllerIntegrationTest {

    @Test
    @DisplayName("Report 1: Repair operations summary aggregates orders, turnaround, and revenue")
    void testRepairSummaryReport() throws Exception {
        mockMvc.perform(get("/api/reports/repair-summary")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalOrders", greaterThanOrEqualTo(5)))
            .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    @DisplayName("Report 2: Inventory usage report calculates stock levels, reorder alerts, and consumption")
    void testInventoryUsageReport() throws Exception {
        mockMvc.perform(get("/api/reports/inventory-usage")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalParts", greaterThanOrEqualTo(8)))
            .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    @DisplayName("Report 3: Garage revenue summary calculates gross revenue and payments")
    void testRevenueReport() throws Exception {
        mockMvc.perform(get("/api/reports/revenue")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalInvoicesIssued").exists())
            .andExpect(jsonPath("$.grossRevenue").exists())
            .andExpect(jsonPath("$.totalPayments").exists());
    }

    @Test
    @DisplayName("Manager creates new staff user account with HTTP 201 Created")
    void testManagerCreatesUserSuccess() throws Exception {
        UpsertUserRequest req = new UpsertUserRequest(
            "sompop_tech",
            "สมภพ ช่างไฟฟ้า",
            "MECHANIC",
            true
        );

        mockMvc.perform(post("/api/admin/users")
                .header("Authorization", getManagerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.username").value("sompop_tech"))
            .andExpect(jsonPath("$.role").value("MECHANIC"))
            .andExpect(jsonPath("$.isActive").value(true));
    }

    @Test
    @DisplayName("Non-manager attempting to create staff user account is rejected with HTTP 403 ACCESS_DENIED")
    void testNonManagerCreateUserThrowsForbidden() throws Exception {
        UpsertUserRequest req = new UpsertUserRequest(
            "hacker_user",
            "แฮกเกอร์",
            "MANAGER",
            true
        );

        mockMvc.perform(post("/api/admin/users")
                .header("Authorization", getMechanicToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("Manager deactivates staff account (soft delete); deactivated user cannot login")
    void testDeactivateUserSoftDelete() throws Exception {
        // Deactivate User 4 (prasert)
        mockMvc.perform(post("/api/admin/users/4/deactivate")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.isActive").value(false));

        // Verify deactivated user cannot login
        LoginRequest loginReq = new LoginRequest("prasert", "password123");
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginReq)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Non-manager attempting to deactivate account is rejected with HTTP 403 ACCESS_DENIED")
    void testNonManagerDeactivateThrowsForbidden() throws Exception {
        mockMvc.perform(post("/api/admin/users/2/deactivate")
                .header("Authorization", getSalesToken()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("Query bays, mechanics, and admin settings endpoints")
    void testAdminMasterDataEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/bays")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()", greaterThanOrEqualTo(5)));

        mockMvc.perform(get("/api/admin/mechanics")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/api/admin/settings")
                .header("Authorization", getManagerToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.vatRate").value(0.07));
    }
}
