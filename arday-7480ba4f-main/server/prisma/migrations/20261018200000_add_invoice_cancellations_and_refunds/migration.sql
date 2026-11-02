ALTER TABLE `invoices`
  ADD COLUMN `amount_waived` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `cancellation_type` VARCHAR(30) NULL,
  ADD COLUMN `cancellation_reason` TEXT NULL,
  ADD COLUMN `cancellation_note` TEXT NULL,
  ADD COLUMN `cancelled_at` DATETIME(0) NULL,
  ADD COLUMN `cancelled_by` CHAR(36) NULL,
  ADD COLUMN `related_invoice_id` CHAR(36) NULL,
  ADD INDEX `idx_invoices_cancelled_by` (`cancelled_by`),
  ADD INDEX `idx_invoices_related_invoice_id` (`related_invoice_id`),
  ADD CONSTRAINT `fk_invoices_cancelled_by`
    FOREIGN KEY (`cancelled_by`) REFERENCES `profiles` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT `fk_invoices_related_invoice_id`
    FOREIGN KEY (`related_invoice_id`) REFERENCES `invoices` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE `invoice_refunds` (
  `id` CHAR(36) NOT NULL,
  `invoice_id` CHAR(36) NOT NULL,
  `payment_history_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(14, 2) NOT NULL,
  `refund_date` DATE NOT NULL,
  `reason` TEXT NOT NULL,
  `note` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'processed',
  `recorded_by` CHAR(36) NULL,
  `school_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(0) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_invoice_refunds_invoice_id` (`invoice_id`),
  INDEX `idx_invoice_refunds_payment_history_id` (`payment_history_id`),
  INDEX `idx_invoice_refunds_recorded_by` (`recorded_by`),
  INDEX `idx_invoice_refunds_school_id` (`school_id`),
  CONSTRAINT `fk_invoice_refunds_invoice_id`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_invoice_refunds_payment_history_id`
    FOREIGN KEY (`payment_history_id`) REFERENCES `payment_history` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_invoice_refunds_recorded_by`
    FOREIGN KEY (`recorded_by`) REFERENCES `profiles` (`id`)
    ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_invoice_refunds_school_id`
    FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);
