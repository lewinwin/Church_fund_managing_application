// Modal wrapper around the correction form, used from the "Returned to correct"
// list. (Opening a returned receipt instead shows the same form beside the
// receipt drawer, so the receipt stays visible while correcting.)
import { Modal } from "#/components/ui/Overlay";
import type { Expense } from "#/lib/types";
import { EditExpenseForm } from "./EditExpenseForm";

export function EditExpenseModal({
	expense,
	onClose,
}: {
	expense: Expense | null;
	onClose: () => void;
}) {
	if (!expense) return null;
	return (
		<Modal open onClose={onClose} title="Correct & resubmit">
			<EditExpenseForm expense={expense} onDone={onClose} onCancel={onClose} />
		</Modal>
	);
}
