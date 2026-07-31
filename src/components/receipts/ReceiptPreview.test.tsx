// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReceiptPreview } from "./ReceiptPreview";

afterEach(cleanup);

const PDF_URL = "data:application/pdf;base64,JVBERi0xLjQK";
const IMG_URL = "data:image/png;base64,iVBORw0KGgo=";

const embeds = (c: HTMLElement) =>
	c.querySelectorAll('embed[type="application/pdf"]');

describe("ReceiptPreview", () => {
	describe("PDF receipts", () => {
		it("offers the expand affordance, same as an image", () => {
			render(<ReceiptPreview dataUrl={PDF_URL} fileName="receipt.pdf" />);
			expect(screen.getByLabelText("Expand receipt")).toBeTruthy();
		});

		it("opens a lightbox holding a second, larger embed", () => {
			const { container } = render(
				<ReceiptPreview dataUrl={PDF_URL} fileName="receipt.pdf" />,
			);
			expect(embeds(container)).toHaveLength(1);

			fireEvent.click(screen.getByLabelText("Expand receipt"));

			expect(embeds(container)).toHaveLength(2);
			// The expanded one is sized to the viewport rather than the inline box.
			const expanded = embeds(container)[1] as HTMLEmbedElement;
			expect(expanded.style.height).toBe("92vh");
			expect(expanded.src).toBe(PDF_URL);
		});

		it("closes the lightbox on Escape", () => {
			const { container } = render(
				<ReceiptPreview dataUrl={PDF_URL} fileName="receipt.pdf" />,
			);
			fireEvent.click(screen.getByLabelText("Expand receipt"));
			expect(embeds(container)).toHaveLength(2);

			fireEvent.keyDown(window, { key: "Escape" });

			expect(embeds(container)).toHaveLength(1);
			expect(screen.queryByLabelText("Close receipt preview")).toBeNull();
		});

		it("closes the lightbox on the close button", () => {
			const { container } = render(
				<ReceiptPreview dataUrl={PDF_URL} fileName="receipt.pdf" />,
			);
			fireEvent.click(screen.getByLabelText("Expand receipt"));

			fireEvent.click(screen.getAllByLabelText("Close receipt preview")[0]);

			expect(embeds(container)).toHaveLength(1);
		});

		it("honours zoomable={false}", () => {
			render(
				<ReceiptPreview
					dataUrl={PDF_URL}
					fileName="receipt.pdf"
					zoomable={false}
				/>,
			);
			expect(screen.queryByLabelText("Expand receipt")).toBeNull();
		});

		it("recognises a PDF by file extension when the mime is generic", () => {
			render(
				<ReceiptPreview
					dataUrl="data:application/octet-stream;base64,JVBERi0="
					fileName="scan.PDF"
				/>,
			);
			expect(screen.getByLabelText("Expand receipt")).toBeTruthy();
		});
	});

	describe("image receipts (unchanged)", () => {
		it("still expands from the button and from the image itself", () => {
			const { container } = render(
				<ReceiptPreview dataUrl={IMG_URL} fileName="receipt.png" />,
			);
			expect(container.querySelectorAll("img")).toHaveLength(1);

			fireEvent.click(screen.getByLabelText("Expand receipt"));
			expect(container.querySelectorAll("img")).toHaveLength(2);

			fireEvent.keyDown(window, { key: "Escape" });
			fireEvent.click(container.querySelectorAll("img")[0]);
			expect(container.querySelectorAll("img")).toHaveLength(2);
		});

		it("wins over the extension check when both could match", () => {
			const { container } = render(
				<ReceiptPreview dataUrl={IMG_URL} fileName="mislabelled.pdf" />,
			);
			expect(container.querySelectorAll("img")).toHaveLength(1);
			expect(embeds(container)).toHaveLength(0);
		});
	});

	it("falls back to the placeholder with no file", () => {
		render(<ReceiptPreview dataUrl={null} fileName={null} />);
		expect(screen.getByText("No receipt file attached")).toBeTruthy();
		expect(screen.queryByLabelText("Expand receipt")).toBeNull();
	});
});
