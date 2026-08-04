// Ensure the receipts bucket exists (idempotent). For a STANDALONE MinIO dev
// setup (no Docker) — with docker-compose the minio-init service does this.
//   bun run s3:init
import process from "node:process";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET ?? "receipts";
const s3 = new S3Client({
	region: process.env.S3_REGION ?? "auto",
	endpoint: process.env.S3_ENDPOINT,
	forcePathStyle: true,
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
	},
});

try {
	await s3.send(new CreateBucketCommand({ Bucket: bucket }));
	console.log(`created private bucket "${bucket}"`);
} catch (err) {
	const name = (err as { name?: string })?.name;
	if (name === "BucketAlreadyOwnedByYou" || name === "BucketAlreadyExists") {
		console.log(`bucket "${bucket}" already exists`);
	} else {
		throw err;
	}
}
process.exit(0);
