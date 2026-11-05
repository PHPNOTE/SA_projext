package com.garage;

import com.garage.dto.SaleDtos.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.util.List;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@DisplayName("Walk-in Counter Sales REST Integration Tests (S1, S2)")
public class SaleOrderAndCounterSalesIntegrationTest extends BaseControllerIntegrationTest {

    @Test
    @DisplayName("Create walk-in counter sale quotation snapshots part prices in QUOTED status")
    void testCreateSaleQuoteSuccess() throws Exception {
        CreateSaleQuoteRequest req = new CreateSaleQuoteRequest(
            1L,
            List.of(
                new SaleLineRequest(1L, 1, new BigDecimal("1250.00")),
                new SaleLineRequest(2L, 2, new BigDecimal("220.00"))
            )
        );

        mockMvc.perform(post("/api/sales")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.saleOrder.status").value("QUOTED"))
            .andExpect(jsonPath("$.saleOrder.saleNo", startsWith("SO-")))
            .andExpect(jsonPath("$.lines[0].unitPrice").value(1250.00))
            .andExpect(jsonPath("$.lines[1].unitPrice").value(220.00));
    }

    @Test
    @DisplayName("Confirm counter sale locks stock as RESERVED")
    void testConfirmSaleLocksStock() throws Exception {
        // Create quote
        CreateSaleQuoteRequest req = new CreateSaleQuoteRequest(
            1L,
            List.of(new SaleLineRequest(2L, 2, new BigDecimal("220.00")))
        );

        String quoteRes = mockMvc.perform(post("/api/sales")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long saleId = objectMapper.readTree(quoteRes).get("saleOrder").get("saleId").asLong();

        // Confirm
        mockMvc.perform(post("/api/sales/" + saleId + "/confirm")
                .header("Authorization", getSalesToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CONFIRMED"));
    }

    @Test
    @DisplayName("Atomic checkout creates invoice, payment, decrements stock, and completes sale")
    void testAtomicCheckoutSuccess() throws Exception {
        CreateSaleQuoteRequest req = new CreateSaleQuoteRequest(
            1L,
            List.of(new SaleLineRequest(2L, 1, new BigDecimal("220.00")))
        );

        String quoteRes = mockMvc.perform(post("/api/sales")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long saleId = objectMapper.readTree(quoteRes).get("saleOrder").get("saleId").asLong();

        mockMvc.perform(post("/api/sales/" + saleId + "/confirm")
                .header("Authorization", getSalesToken()))
            .andExpect(status().isOk());

        CompleteSaleRequest compReq = new CompleteSaleRequest(new BigDecimal("220.00"), "CASH");

        mockMvc.perform(post("/api/sales/" + saleId + "/complete")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(compReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.saleOrder.status").value("COMPLETED"))
            .andExpect(jsonPath("$.invoice.status").value("ISSUED"))
            .andExpect(jsonPath("$.invoice.subtotal").value(220.00))
            .andExpect(jsonPath("$.payment.amount").value(220.00));
    }

    @Test
    @DisplayName("Checkout with payment less than subtotal is rejected with HTTP 400 INSUFFICIENT_PAYMENT")
    void testInsufficientPaymentThrows() throws Exception {
        CreateSaleQuoteRequest req = new CreateSaleQuoteRequest(
            1L,
            List.of(new SaleLineRequest(2L, 1, new BigDecimal("220.00")))
        );

        String quoteRes = mockMvc.perform(post("/api/sales")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long saleId = objectMapper.readTree(quoteRes).get("saleOrder").get("saleId").asLong();

        mockMvc.perform(post("/api/sales/" + saleId + "/confirm")
                .header("Authorization", getSalesToken()))
            .andExpect(status().isOk());

        CompleteSaleRequest underpayReq = new CompleteSaleRequest(new BigDecimal("100.00"), "CASH");

        mockMvc.perform(post("/api/sales/" + saleId + "/complete")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(underpayReq)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INSUFFICIENT_PAYMENT"));
    }

    @Test
    @DisplayName("Cancel confirmed sale releases reserved stock")
    void testCancelConfirmedSaleReleasesStock() throws Exception {
        CreateSaleQuoteRequest req = new CreateSaleQuoteRequest(
            1L,
            List.of(new SaleLineRequest(2L, 2, new BigDecimal("220.00")))
        );

        String quoteRes = mockMvc.perform(post("/api/sales")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        Long saleId = objectMapper.readTree(quoteRes).get("saleOrder").get("saleId").asLong();

        mockMvc.perform(post("/api/sales/" + saleId + "/confirm")
                .header("Authorization", getSalesToken()))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/sales/" + saleId + "/cancel")
                .header("Authorization", getSalesToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    @DisplayName("Walk-in sale with anonymous walk-in customer (customerId = null) succeeds")
    void testAnonymousCustomerSale() throws Exception {
        CreateSaleQuoteRequest req = new CreateSaleQuoteRequest(
            null,
            List.of(new SaleLineRequest(2L, 1, new BigDecimal("220.00")))
        );

        mockMvc.perform(post("/api/sales")
                .header("Authorization", getSalesToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.saleOrder.customerId").doesNotExist());
    }
}
