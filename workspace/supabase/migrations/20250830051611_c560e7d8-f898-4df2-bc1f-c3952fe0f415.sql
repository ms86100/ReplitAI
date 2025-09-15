-- Fix calculate_effective_capacity function search path
CREATE OR REPLACE FUNCTION public.calculate_effective_capacity(working_days integer, leaves integer, availability_percent integer, work_mode text, office_weight numeric DEFAULT 1.0, wfh_weight numeric DEFAULT 0.9, hybrid_weight numeric DEFAULT 0.95)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  mode_weight NUMERIC;
BEGIN
  -- Get the weight based on work mode
  CASE work_mode
    WHEN 'office' THEN mode_weight := office_weight;
    WHEN 'wfh' THEN mode_weight := wfh_weight;
    WHEN 'hybrid' THEN mode_weight := hybrid_weight;
    ELSE mode_weight := 1.0;
  END CASE;
  
  -- Calculate effective capacity: (working_days - leaves) * (availability_percent/100) * mode_weight
  RETURN (working_days - leaves) * (availability_percent::NUMERIC / 100.0) * mode_weight;
END;
$function$;