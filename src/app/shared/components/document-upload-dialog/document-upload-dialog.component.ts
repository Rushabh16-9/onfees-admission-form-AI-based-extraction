import { Component, Inject, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import * as globalFunctions from 'app/global/globalFunctions';
import { DocumentExtractionService } from 'app/shared/services/document-extraction.service';
import { ExtractedMarksheetData } from 'app/shared/models/document-extraction.model';

@Component({
    selector: 'app-document-upload-dialog',
    templateUrl: './document-upload-dialog.component.html',
    styleUrls: ['./document-upload-dialog.component.css']
})
export class DocumentUploadDialogComponent implements OnInit {

    isDualUpload: boolean = false;

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

        if (this.data.file) {
            this.sem1File = this.data.file;
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
            if (this.sem1File && this.sem1ExtractedData) {
                this.dialogRef.close({
                    success: true,
                    document_id: this.data.document_id,
                    file: this.sem1File,
                    extractedData: this.sem1ExtractedData
                });
            }
        } else {
            // Dual upload scenario
            if (this.sem1File && this.sem1ExtractedData && this.sem2File && this.sem2ExtractedData) {
                this.dialogRef.close({
                    success: true,
                    document_id: 389, // Returning as Sem 2, but carrying Sem 1 payload
                    file: this.sem2File,
                    extractedData: this.sem2ExtractedData,
                    sem1Data: {
                        file: this.sem1File,
                        extractedData: this.sem1ExtractedData
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
