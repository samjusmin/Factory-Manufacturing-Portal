import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

const httpOptions = {
    headers: new HttpHeaders({
      Authorization: '',
    })
  };

@Component({
    selector: 'change-location-dialog-box',
    templateUrl: 'change-location-dialog-box.html',
})
export class DialogBoxChangeLocationComponent {

    selected = 'option2';
    optionList = [];

    constructor(private http: HttpClient,
        private dialogRef: MatDialogRef<DialogBoxChangeLocationComponent>) {}

    ngOnInit() {
        httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
        this.http
            .get<string[]>('/api/user/loclist', httpOptions)
            .subscribe((locs) => {
                this.optionList = locs;
            },
        (error) => {
            throw error;
        });
    }

    save() {
        console.log("Selected:", this.selected);
        this.dialogRef.close(this.selected);
    }

    close() {
        this.dialogRef.close();
    }
}