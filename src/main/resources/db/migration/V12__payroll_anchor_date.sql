-- employees.payroll_anchor_date
--
-- The day an employee's pay cycle counts from. Every period boundary - daily, weekly or monthly -
-- is derived from this plus the salary_period already on the row, so this one column is what makes
-- the manual "تصفية أسبوع جديد" button unnecessary: a computed period cannot be reset at the wrong
-- moment, cannot drift while the café is closed, and answers correctly about the past as well as
-- about today.
ALTER TABLE employees ADD COLUMN ${add_col_if_not_exists}payroll_anchor_date DATE;

-- Existing staff start from the day they were hired, which is the cycle they were actually
-- engaged on. Rows with no hire date are left NULL and fall back to "today" in code rather than
-- having a start date invented for them here.
UPDATE employees SET payroll_anchor_date = hire_date
 WHERE payroll_anchor_date IS NULL AND hire_date IS NOT NULL;
