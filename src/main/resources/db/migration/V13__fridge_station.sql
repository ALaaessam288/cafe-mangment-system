-- A third preparation station: الثلاجة.
--
-- A bottle of water and a can of soft drink are not prepared anywhere. With only KITCHEN and BAR
-- to choose from they were filed under the kitchen, so the chef received a slip asking for two
-- waters he has nothing to do with, and the person who actually fetches them - standing at the
-- cooler - received nothing. Printing already routes one ticket per station, so the whole feature
-- is this row plus the enum value: give it a station and it gets its own slip.
--
-- Backfilled for every existing tenant, because a station that only new tenants get is a station
-- the café that asked for it does not have.
INSERT INTO stations (tenant_id, name_ar, code, created_at, updated_at, version)
SELECT t.id, 'الثلاجة', 'FRIDGE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0
  FROM tenants t
 WHERE NOT EXISTS (
       SELECT 1 FROM stations s WHERE s.tenant_id = t.id AND s.code = 'FRIDGE'
 );
