import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import {
  COUNTRY_CODE_PATTERN,
  NATIONAL_PHONE_PATTERN,
  normalizeCountryCode,
  normalizeNationalPhone,
} from "@/lib/phone";

export type CustomerPhoneFieldProps = {
  countryCode: string;
  nationalNumber: string;
  onCountryCodeChange: (value: string) => void;
  onNationalNumberChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

export default function CustomerPhoneField({
  countryCode,
  nationalNumber,
  onCountryCodeChange,
  onNationalNumberChange,
  invalid = false,
  describedBy,
}: CustomerPhoneFieldProps) {
  const descriptionIds = ["customer-phone-description", describedBy].filter(Boolean).join(" ");

  return (
    <Field data-invalid={invalid || undefined} className="gap-1.5">
      <FieldLabel id="customer-phone-label" htmlFor="phone">
        Phone number
      </FieldLabel>
      <InputGroup
        className="h-11 rounded-xl bg-muted/40"
        aria-label="Phone number fields"
        aria-describedby={descriptionIds}
        aria-invalid={invalid || undefined}
      >
        <InputGroupInput
          id="countryCode"
          name="countryCode"
          type="tel"
          inputMode="tel"
          value={countryCode}
          onChange={(e) => onCountryCodeChange(normalizeCountryCode(e.target.value))}
          placeholder="+91"
          aria-label="Country code"
          autoComplete="tel-country-code"
          required
          maxLength={4}
          pattern={COUNTRY_CODE_PATTERN.source}
          aria-describedby={descriptionIds}
          aria-invalid={invalid || undefined}
          className="h-11 w-24 rounded-none border-0 border-r px-3 text-center text-lg font-bold shadow-none"
        />
        <InputGroupInput
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          value={nationalNumber}
          onChange={(e) => onNationalNumberChange(normalizeNationalPhone(e.target.value))}
          placeholder="98765 43210"
          autoComplete="tel-national"
          required
          minLength={5}
          maxLength={14}
          pattern={NATIONAL_PHONE_PATTERN.source}
          aria-describedby={descriptionIds}
          aria-invalid={invalid || undefined}
          className="h-11 rounded-none px-4 text-lg font-bold shadow-none"
        />
      </InputGroup>
      <FieldDescription id="customer-phone-description" className="text-xs">
        Include your country code and phone number.
      </FieldDescription>
    </Field>
  );
}
