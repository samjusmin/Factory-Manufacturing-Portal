import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatTableDataSource } from '@angular/material/table';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { FATProjectService } from '../fat-project.service';
import { FATcategory } from '@webproject/data';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

const CATEGORIES =  [
  "Kiosk Common",
  "Unit X1 Common",
  "KioskA Common", 
  "Honeywell Scanner", 
  "Printer", 
  "Access BP", 
  "Document Reader", 
  "Handheld Scanner", 
  "NFC", 
  "Magnetic Card", 
  "Livestream", 
  "Bio Module", 
  "Payment Terminal", 
  "Disability Pad", 
  "Microphone", 
  "Speaker", 
  "LED", 
  "ASI", 
  "Switch", 
  "Bios",
  "Unit Z Hardware",
  "Unit Z Plus Hardware",
  "Unit Z Compact Hardware",
  "Unit W2 Hardware",
  "Centre Module",
  "Front Module",
  "Roof Module",
  "MCP Module",
  "Rear Extension Module",
  "Serial Numbers",
  "Unit Y Electrical",
  "Roof Middle Panel Assembly",
  "Unit X1 Serial Numbers"
];

interface FATcat {
  category: string,
  progress: number
}

@Component({
  selector: 'webproject-fat-edit-cat',
  templateUrl: './fat-edit-cat.component.html',
  styleUrls: ['./fat-edit-cat.component.css']
})

export class FATEditCategoriesComponent implements OnInit {

  postData: Array<{project: string, prefix: string, location: string, number: number, checker: string, unit_type: string, printers: number,
                  opt_bio: boolean, opt_honeywell: boolean, opt_desko: boolean, opt_nfc: boolean, opt_magnetic: boolean}> = [];

  typeControl = new FormControl('');
  checkerControl = new FormControl('');
  createFATForm = this.formBuilder.group({
    FATproject: [''],
    FATprefix: [''],
    FATlocation: [''],
    FATamount: [''],
    FATchecker: this.checkerControl,
    UnitType: this.typeControl,
    FATprinters: [''],
    FATbio: false,
    FAThoneywell: false,
    FATdocreader: false,
    FATnfc: false,
    FATmagnetic: false
  });

  constructor(
    private cdr: ChangeDetectorRef,
    private formBuilder: FormBuilder,
    private http: HttpClient, 
    public FATProjectService: FATProjectService,
  ) {
    FATProjectService.isAdmin = false;
    FATProjectService.showError = false;
    FATProjectService.isLoaded = false;
  }

  editable = false;
  categories =  [
    "Kiosk Common",
    "Unit X1 Common",
    "KioskA Common", 
    "Honeywell Scanner", 
    "Printer", 
    "Access BP", 
    "Document Reader", 
    "Handheld Scanner", 
    "NFC", 
    "Magnetic Card", 
    "Livestream", 
    "Bio Module", 
    "Payment Terminal", 
    "Disability Pad", 
    "Microphone", 
    "Speaker", 
    "LED", 
    "ASI", 
    "Switch", 
    "Bios",
    "Unit Z Hardware",
    "Unit Z Plus Hardware",
    "Unit Z Compact Hardware",
    "Unit W2 Hardware",
    "Centre Module",
    "Front Module",
    "Roof Module",
    "MCP Module",
    "Rear Extension Module",
    "Serial Numbers",
    "Unit Y Electrical",
    "Roof Middle Panel Assembly",
    "Serial Numbers",
    "Unit X1 Serial Numbers"
  ];

  // displayedColumns = [];
  

  // columnNames = [
  //   {
  //     name: 'name',
  //     value: 'Category'
  //   },
  //   {
  //     name: 'progress',
  //     value: 'Progress'
  //   }
  // ];

  ngOnInit(): void {
    // let res = [
    //   {category: 'Main', progress: 0},
    //   {category: 'Passport Reader', progress: 30},
    //   {category: 'Magnetic Card Reader', progress: 60},
    //   {category: 'Printer 1', progress: 100},
    //   {category: 'Printer 2', progress: 100},
    //   {category: 'Final Check', progress: 100},
    // ];
    // this.categories = res;

    // this.displayedColumns = this.columnNames.map((x) => x.name);
    // // this.fatSource = new MatTableDataSource<FATUnit>(res);
    // // console.log(this.fatSource)


    // this.displayedColumns = this.columnNames.map((x) => x.name);
    // // console.log("DOES THIS EVEN WORK");
    // this.FATProjectService.getAllCategories();
    this.FATProjectService.checkIfAdmin();
    this.FATProjectService.isLoaded = true;

    console.log("END");
    console.log("THIS IS THE CAT");
    console.log(this.categories);
    
  }

  getChecklist(category: string) {
    console.log("getChecklist is working");
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<FATcategory[]>('/api/factory-acceptance-test/'+ category, httpOptions)
      .subscribe((res) => {
      }, (error) => {
        throw error;
      });
    
  }

  getCategories() {
    console.log("GRABBING CATEGORIES", this.categories);
    this.FATProjectService.isLoaded = true;
    return this.categories;
  }

}
