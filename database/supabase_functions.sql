-- Function to calculate average completion time
CREATE OR REPLACE FUNCTION calculate_average_completion_time()
RETURNS TABLE (avg_completion_time DOUBLE PRECISION) AS $
BEGIN
  RETURN QUERY
  SELECT
    AVG(EXTRACT(EPOCH FROM (completedAt - assignedAt)))
  FROM orders
  WHERE 
    status = 'COMPLETED' 
    AND completedAt IS NOT NULL 
    AND assignedAt IS NOT NULL;
END;
$ LANGUAGE plpgsql;

-- Function to get monthly order statistics
CREATE OR REPLACE FUNCTION get_monthly_order_stats()
RETURNS TABLE (
  month TEXT,
  total BIGINT,
  completed BIGINT,
  cancelled BIGINT,
  avg_completion_hours FLOAT
) AS $
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', createdAt), 'Month YYYY') AS month,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
    AVG(
      CASE 
        WHEN status = 'COMPLETED' AND completedAt IS NOT NULL AND assignedAt IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (completedAt - assignedAt)) / 3600 
        ELSE NULL 
      END
    ) AS avg_completion_hours
  FROM orders
  GROUP BY DATE_TRUNC('month', createdAt)
  ORDER BY DATE_TRUNC('month', createdAt) DESC
  LIMIT 6;
END;
$ LANGUAGE plpgsql;