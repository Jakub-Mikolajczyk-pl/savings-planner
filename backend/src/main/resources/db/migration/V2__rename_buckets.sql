-- V2: nowy zestaw bucketów (user-friendly nazwy zamiast technicznych typów).
-- accounts, safety_cushion, retirement, renovation, investments, vacation, emergency_fund.
-- bucket jest pilnowany CHECK-iem, więc kolejność: zdejmij stary CHECK -> zmapuj dane -> nałóż nowy.

alter table finance.accounts drop constraint if exists accounts_bucket_check;

-- Mapowanie istniejących wartości na nowy zestaw (down_payment/crypto nie mają odpowiednika 1:1).
update finance.accounts set bucket = case bucket
    when 'cash' then 'accounts'
    when 'investment' then 'investments'
    when 'down_payment' then 'accounts'
    when 'crypto' then 'investments'
    else bucket
end;

alter table finance.accounts
    add constraint accounts_bucket_check
    check (bucket in ('accounts', 'safety_cushion', 'retirement', 'renovation', 'investments', 'vacation', 'emergency_fund'));

alter table finance.accounts alter column bucket set default 'accounts';

-- settings.emergencyFundBuckets mogło trzymać stare wartości (np. ["cash","investment"]).
-- Reset do nowego domyślnego (poduszka); użytkownik może przewybrać w UI.
update finance.app_settings
set payload = jsonb_set(payload, '{emergencyFundBuckets}', '["safety_cushion"]'::jsonb)
where payload ? 'emergencyFundBuckets';
