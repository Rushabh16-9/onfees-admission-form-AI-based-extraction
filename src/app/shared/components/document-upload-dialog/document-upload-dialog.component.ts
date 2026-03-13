import { Component, Inject, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import * as globalFunctions from 'app/global/globalFunctions';
import { DocumentExtractionService } from 'app/shared/services/document-extraction.service';
import { ExtractedMarksheetData } from 'app/shared/models/document-extraction.model';
import { forkJoin } from 'rxjs';

@Component({
    selector: 'app-document-upload-dialog',
    templateUrl: './document-upload-dialog.component.html',
    styleUrls: ['./document-upload-dialog.component.css']
})
export class DocumentUploadDialogComponent implements OnInit {

    isDualUpload: boolean = false;
    isVerificationOnlyDoc: boolean = false;
    isSubmitting: boolean = false;
    submitError: string = '';
    private readonly maxFileSizeMbMarksheet: number = 20;
    private readonly maxFileSizeMbVerificationOnly: number = 2;

    // --- Sem 1 State ---
    sem1File: File | null = null;
    sem1ImagePreviewUrl: string | null = null;
    sem1IsExtracting: boolean = false;
    sem1IsVerifying: boolean = false;
    sem1ExtractedData: ExtractedMarksheetData | null = null;
    sem1VerificationFailed: boolean = false;
    sem1VerificationMessage: string = '';
    sem1ExtractionError: string = '';

    // --- Sem 2 State ---
    sem2File: File | null = null;
    sem2ImagePreviewUrl: string | null = null;
    sem2IsExtracting: boolean = false;
    sem2IsVerifying: boolean = false;
    sem2ExtractedData: ExtractedMarksheetData | null = null;
    sem2VerificationFailed: boolean = false;
    sem2VerificationMessage: string = '';
    sem2ExtractionError: string = '';

    constructor(
        public dialogRef: MatDialogRef<DocumentUploadDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { document_name: string, document_id: number, file?: File },
        private extractionService: DocumentExtractionService
    ) {
        // Prevent closing by clicking outside or escape
        dialogRef.disableClose = true;
    }

    ngOnInit(): void {
        const docNameLower = this.data.document_name.toLowerCase();
        if (docNameLower.includes('sem 1 marksheet')) {
            this.isDualUpload = true; // Flag indicates this modal should show Sem 1 & Sem 2 side-by-side
        }
        this.isVerificationOnlyDoc = /\b(aadhaar|aadhar|adhar|uidai|aadhaarcard|aadharcard|adharcard|address\s*proof|physically\s*handicapped|visually\s*impaired|learning\s*disability|disability|abc\s*id|academic\s*bank\s*of\s*credits)\b/.test(docNameLower);

        if (this.data.file) {
            this.sem1File = this.data.file;
            if (!this.validateSelectedFile(this.sem1File, 1)) {
                return;
            }
            if (this.sem1File.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => this.sem1ImagePreviewUrl = reader.result as string;
                reader.readAsDataURL(this.sem1File);
            }
            this.extractData(1);
        }
    }

    onFileSelected(event: any, docIndex: number): void {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];

            if (!this.validateSelectedFile(file, docIndex)) {
                event.target.value = '';
                return;
            }
            
            if (docIndex === 1) {
                this.sem1File = file;
                this.sem1ExtractionError = '';
                this.sem1VerificationFailed = false;

                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = e => this.sem1ImagePreviewUrl = reader.result as string;
                    reader.readAsDataURL(file);
                } else {
                    this.sem1ImagePreviewUrl = null;
                }
            } else {
                this.sem2File = file;
                this.sem2ExtractionError = '';
                this.sem2VerificationFailed = false;

                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = e => this.sem2ImagePreviewUrl = reader.result as string;
                    reader.readAsDataURL(file);
                } else {
                    this.sem2ImagePreviewUrl = null;
                }
            }

            // Auto-start extraction and verification for the specific document
            this.extractData(docIndex);
        }
    }

    private validateSelectedFile(file: File, docIndex: number): boolean {
        const maxFileSizeMb = this.isVerificationOnlyDoc ? this.maxFileSizeMbVerificationOnly : this.maxFileSizeMbMarksheet;
        const fileSizeInMb = file.size / (1024 * 1024);
        if (fileSizeInMb <= maxFileSizeMb) {
            return true;
        }

        const roundedSize = Math.round(fileSizeInMb * 100) / 100;
        const message = `File size ${roundedSize} MB exceeds limit of ${maxFileSizeMb} MB. Please upload a smaller file.`;

        if (docIndex === 1) {
            this.sem1File = null;
            this.sem1ImagePreviewUrl = null;
            this.sem1ExtractedData = null;
            this.sem1IsExtracting = false;
            this.sem1IsVerifying = false;
            this.sem1VerificationFailed = true;
            this.sem1VerificationMessage = '✗ File too large';
            this.sem1ExtractionError = message;
        } else {
            this.sem2File = null;
            this.sem2ImagePreviewUrl = null;
            this.sem2ExtractedData = null;
            this.sem2IsExtracting = false;
            this.sem2IsVerifying = false;
            this.sem2VerificationFailed = true;
            this.sem2VerificationMessage = '✗ File too large';
            this.sem2ExtractionError = message;
        }

        return false;
    }

    extractData(docIndex: number): void {
        const file = docIndex === 1 ? this.sem1File : this.sem2File;
        if (!file) return;

        let docName = this.data.document_name;
        if (this.isDualUpload) {
            docName = docIndex === 1 ? 'Sem 1 Marksheet' : 'Sem 2 Marksheet';
        }

        if (docIndex === 1) {
            this.sem1IsExtracting = true;
            this.sem1IsVerifying = true;
            this.sem1VerificationMessage = 'Verifying document...';
            this.sem1ExtractionError = '';
        } else {
            this.sem2IsExtracting = true;
            this.sem2IsVerifying = true;
            this.sem2VerificationMessage = 'Verifying document...';
            this.sem2ExtractionError = '';
        }

        if (this.isVerificationOnlyDoc) {
            this.extractionService.verifyDocument(file, docName).subscribe({
                next: (response) => {
                    const verification = response?.verification;
                    const isValid = !!(response?.success && verification?.isValid);
                    const reason = verification?.reason || response?.error || '';

                    if (docIndex === 1) {
                        this.sem1IsExtracting = false;
                        this.sem1IsVerifying = false;
                        if (isValid) {
                            this.sem1VerificationFailed = false;
                            this.sem1VerificationMessage = `✓ Verified as ${docName}`;
                            this.sem1ExtractedData = null;
                        } else {
                            this.sem1VerificationFailed = true;
                            this.sem1VerificationMessage = '✗ Verification failed';
                            this.sem1ExtractionError = reason || 'Uploaded file is not a valid document.';
                        }
                    } else {
                        this.sem2IsExtracting = false;
                        this.sem2IsVerifying = false;
                        if (isValid) {
                            this.sem2VerificationFailed = false;
                            this.sem2VerificationMessage = `✓ Verified as ${docName}`;
                            this.sem2ExtractedData = null;
                        } else {
                            this.sem2VerificationFailed = true;
                            this.sem2VerificationMessage = '✗ Verification failed';
                            this.sem2ExtractionError = reason || 'Uploaded file is not a valid document.';
                        }
                    }
                },
                error: (error) => {
                    if (docIndex === 1) {
                        this.sem1IsExtracting = false;
                        this.sem1IsVerifying = false;
                        this.sem1VerificationFailed = true;
                        this.sem1VerificationMessage = '✗ Verification failed';
                        this.sem1ExtractionError = error?.message || 'Failed to verify document.';
                    } else {
                        this.sem2IsExtracting = false;
                        this.sem2IsVerifying = false;
                        this.sem2VerificationFailed = true;
                        this.sem2VerificationMessage = '✗ Verification failed';
                        this.sem2ExtractionError = error?.message || 'Failed to verify document.';
                    }
                }
            });
            return;
        }

        this.extractionService.extractMarksheetData(file, docName).subscribe({
            next: (response) => {
                if (docIndex === 1) {
                    this.sem1IsExtracting = false;
                    this.sem1IsVerifying = false;
                    if (response.success && response.data) {
                        this.sem1VerificationMessage = `✓ Verified as ${docName}`;
                        this.sem1ExtractedData = response.data;
                    } else {
                        this.sem1VerificationFailed = true;
                        this.sem1VerificationMessage = '✗ Verification failed';
                        this.sem1ExtractionError = response.error || 'Failed to extract data.';
                    }
                } else {
                    this.sem2IsExtracting = false;
                    this.sem2IsVerifying = false;
                    if (response.success && response.data) {
                        this.sem2VerificationMessage = `✓ Verified as ${docName}`;
                        this.sem2ExtractedData = response.data;
                    } else {
                        this.sem2VerificationFailed = true;
                        this.sem2VerificationMessage = '✗ Verification failed';
                        this.sem2ExtractionError = response.error || 'Failed to extract data.';
                    }
                }
            },
            error: (error) => {
                if (docIndex === 1) {
                    this.sem1IsExtracting = false;
                    this.sem1IsVerifying = false;
                    this.sem1VerificationFailed = true;
                    this.sem1VerificationMessage = '✗ Invalid Document';
                    this.sem1ExtractionError = error.message;
                } else {
                    this.sem2IsExtracting = false;
                    this.sem2IsVerifying = false;
                    this.sem2VerificationFailed = true;
                    this.sem2VerificationMessage = '✗ Invalid Document';
                    this.sem2ExtractionError = error.message;
                }
            }
        });
    }

    submit(): void {
        if (!this.isDualUpload) {
            if (this.sem1File && (this.sem1ExtractedData || (this.isVerificationOnlyDoc && !this.sem1VerificationFailed && !this.sem1IsVerifying))) {
                this.dialogRef.close({
                    success: true,
                    document_id: this.data.document_id,
                    file: this.sem1File,
                    extractedData: this.sem1ExtractedData
                });
            }
        } else {
            // Dual upload: upload both files to server first, then close with filenames
            if (this.sem1File && this.sem1ExtractedData && this.sem2File && this.sem2ExtractedData) {
                this.isSubmitting = true;
                this.submitError = '';
                const sem1Upload$ = this.extractionService.uploadDocImage(this.sem1File, this.data.document_id);
                const sem2Upload$ = this.extractionService.uploadDocImage(this.sem2File, 389);
                forkJoin({ sem1: sem1Upload$, sem2: sem2Upload$ }).subscribe({
                    next: (results: any) => {
                        this.isSubmitting = false;
                        this.dialogRef.close({
                            success: true,
                            document_id: this.data.document_id,
                            sem2_document_id: 389,
                            fileName: results.sem2?.dataJson?.fileName || '',
                            extractedData: this.sem2ExtractedData,
                            sem1Data: {
                                document_id: this.data.document_id,
                                fileName: results.sem1?.dataJson?.fileName || '',
                                extractedData: this.sem1ExtractedData
                            }
                        });
                    },
                    error: (err: any) => {
                        this.isSubmitting = false;
                        this.submitError = 'Upload failed. Please check the server connection and try again.';
                        console.error('[DIALOG] Dual upload error:', err);
                    }
                });
            }
        }
    }

    retryExtraction(docIndex: number): void {
        if (docIndex === 1) {
            this.sem1ExtractionError = '';
            this.sem1VerificationFailed = false;
            this.sem1ExtractedData = null;
            if (this.sem1File) this.extractData(1);
        } else {
            this.sem2ExtractionError = '';
            this.sem2VerificationFailed = false;
            this.sem2ExtractedData = null;
            if (this.sem2File) this.extractData(2);
        }
    }
}
