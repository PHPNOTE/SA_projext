package com.garage;

import com.garage.dto.AdminDtos.CreateBayRequest;
import com.garage.dto.AdminDtos.UpsertUserRequest;
import com.garage.dto.RepairDtos.RegisterRepairRequest;
import com.garage.dto.SaleDtos.SaleLineRequest;
import com.garage.dto.SaleDtos.SingleShotSaleRequest;
import com.garage.dto.WarehouseDtos.CreatePORequest;
import com.garage.dto.WarehouseDtos.POLineRequest;
import com.garage.dto.WarehouseDtos.PartUpsertRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("Input Validation Guardrails Integration Tests")
public class InputValidationIntegrationTest extends BaseControllerIntegrationTest {

    @Test
    @DisplayName("Check-in rejects customer name containing digits with HTTP 400 VALIDATION_ERROR")
    void testCheckinRejectsDigitsInCustomerName() throws Exception {
        RegisterRepairRequest req = new RegisterRepairRequest(
            "สมชาย123", "089-123-4567", null,
            "1กข-8899", "Toyota", "Altis", 2022,
            "เบรกมีเสียงดัง", "NORMAL", null, null,
            null, null, false, BigDecimal.ZERO
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Check-in rejects phone number containing letters with HTTP 400 VALIDATION_ERROR")
    void testCheckinRejectsLettersInPhone() throws Exception {
        RegisterRepairRequest req = new RegisterRepairRequest(
            "คุณสมชาย ใจดี", "089-ABC-4567", null,
            "1กข-8899", "Toyota", "Altis", 2022,
            "เบรกมีเสียงดัง", "NORMAL", null, null,
            null, null, false, BigDecimal.ZERO
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Check-in rejects license plate without letters or without numbers")
    void testCheckinRejectsInvalidLicensePlate() throws Exception {
        RegisterRepairRequest req = new RegisterRepairRequest(
            "คุณสมชาย ใจดี", "089-123-4567", null,
            "999999", "Toyota", "Altis", 2022,
            "เบรกมีเสียงดัง", "NORMAL", null, null,
            null, null, false, BigDecimal.ZERO
        );

        mockMvc.perform(post("/api/repairs")
                .header("Authorization", getFrontDeskToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("POS Counter Sale rejects digits in customer name and letters in phone")
    void testCounterSaleRejectsInvalidCustomerInputs() throws Exception {
        SingleShotSaleRequest badNameReq = new SingleShotSaleRequest(
            "ลูกค้า 999", "081-234-5678",
            List.of(new SaleLineRequest(1L, 1, new BigDecimal("1450.00"))),
            "CASH", new BigDecimal("1450.00"), null
        );

        mockMvc.perform(post("/api/sales/complete")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badNameReq)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        SingleShotSaleRequest badPhoneReq = new SingleShotSaleRequest(
            "คุณวิภา", "081-hello",
            List.of(new SaleLineRequest(1L, 1, new BigDecimal("1450.00"))),
            "CASH", new BigDecimal("1450.00"), null
        );

        mockMvc.perform(post("/api/sales/complete")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badPhoneReq)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Admin user creation rejects digits in staff fullName and numeric-only username")
    void testAdminRejectsInvalidStaffInputs() throws Exception {
        UpsertUserRequest badName = new UpsertUserRequest("valid_tech", "ช่างสมชาย 123", "MECHANIC", true);
        mockMvc.perform(post("/api/admin/users")
                .header("Authorization", getManagerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badName)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        UpsertUserRequest badUsername = new UpsertUserRequest("123456", "ช่างสมชาย", "MECHANIC", true);
        mockMvc.perform(post("/api/admin/users")
                .header("Authorization", getManagerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badUsername)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        CreateBayRequest badBay = new CreateBayRequest("9999");
        mockMvc.perform(post("/api/admin/bays")
                .header("Authorization", getManagerToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badBay)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("Warehouse rejects digits in supplier name and numeric-only part name/SKU")
    void testWarehouseRejectsInvalidInputs() throws Exception {
        CreatePORequest badPo = new CreatePORequest(
            "บริษัท อะไหล่ 123 จำกัด", "2026-11-20",
            List.of(new POLineRequest(1L, 5, new BigDecimal("800.00")))
        );
        mockMvc.perform(post("/api/warehouse/pos")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badPo)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        PartUpsertRequest badPart = new PartUpsertRequest("99999", "12345", new BigDecimal("500.00"), 5);
        mockMvc.perform(post("/api/warehouse/parts")
                .header("Authorization", getWarehouseToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badPart)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }
}
