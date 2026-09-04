// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert, AlertTitle } from "../../src/components/ui/alert";
import { Badge } from "../../src/components/ui/badge";
import { Field, FieldLabel } from "../../src/components/ui/field";
import { Input } from "../../src/components/ui/input";

describe("local shadcn primitives", () => {
  it("composes labelled fields and alerts", () => {
    render(
      <>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" />
        </Field>
        <Alert>
          <AlertTitle>Ready</AlertTitle>
        </Alert>
        <Alert variant="success">
          <AlertTitle>Paid alert</AlertTitle>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>Waiting alert</AlertTitle>
        </Alert>
        <Alert variant="info">
          <AlertTitle>Info alert</AlertTitle>
        </Alert>
        <Badge variant="success">Paid</Badge>
        <Badge variant="warning">Waiting</Badge>
        <Badge variant="info">Preparing</Badge>
      </>,
    );
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getAllByRole("alert")[0].textContent).toContain("Ready");
    expect(screen.getAllByRole("alert")[1].className).toContain("bg-success/10");
    expect(screen.getAllByRole("alert")[2].className).toContain("bg-warning/10");
    expect(screen.getAllByRole("alert")[3].className).toContain("bg-info/10");
    expect(screen.getByText("Paid").className).toContain("bg-success");
    expect(screen.getByText("Paid").className).toContain("text-success-foreground");
    expect(screen.getByText("Waiting").className).toContain("bg-warning");
    expect(screen.getByText("Waiting").className).toContain("text-warning-foreground");
    expect(screen.getByText("Preparing").className).toContain("bg-info");
    expect(screen.getByText("Preparing").className).toContain("text-info-foreground");
  });
});
