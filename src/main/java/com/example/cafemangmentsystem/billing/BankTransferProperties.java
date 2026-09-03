package com.example.cafemangmentsystem.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * The account customers transfer to, and how to reach the platform about it.
 *
 * <p>Configuration rather than constants, because these are the platform operator's own banking
 * details — the sort of thing that must never be compiled into a build that ships to customers'
 * machines, and that changes without a release.
 */
@Component
@ConfigurationProperties(prefix = "app.billing.bank")
public class BankTransferProperties {

    private String bankName = "";
    private String accountName = "";
    private String accountNumber = "";
    private String iban = "";
    private String swift = "";
    /** Vodafone Cash / InstaPay handle, if offered. */
    private String wallet = "";
    private String supportPhone = "";
    private String instructions = "";

    public boolean isConfigured() {
        return !accountNumber.isBlank() || !iban.isBlank() || !wallet.isBlank();
    }

    public String getBankName() { return bankName; }
    public void setBankName(String bankName) { this.bankName = bankName; }

    public String getAccountName() { return accountName; }
    public void setAccountName(String accountName) { this.accountName = accountName; }

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }

    public String getIban() { return iban; }
    public void setIban(String iban) { this.iban = iban; }

    public String getSwift() { return swift; }
    public void setSwift(String swift) { this.swift = swift; }

    public String getWallet() { return wallet; }
    public void setWallet(String wallet) { this.wallet = wallet; }

    public String getSupportPhone() { return supportPhone; }
    public void setSupportPhone(String supportPhone) { this.supportPhone = supportPhone; }

    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }
}
