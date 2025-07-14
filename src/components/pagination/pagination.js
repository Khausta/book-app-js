import { DivComponent } from "../../common/div-component.js";
import './pagination.css';

export class Pagination extends DivComponent{
    constructor(state) {
        super();
        // this.appState = appState;
        this.state = state; 
    }

    #next() {
      
        let end = this.state.end;
        const start = end;
        end = start + 9;
       

        if (start > 99) {
            const newOffset = this.state.offset + 100;

            if(newOffset > this.state.numFound) return;

            this.state.offset = newOffset;
            this.state.end = this.state.docs.length > 10 ? 9 : this.state.docs.length;
            this.state.start = 0;
            return;
        }

        if (end < this.state.docs.length) {
            this.state.end = end;
            this.state.start = start;
            
        } else {
            this.state.end = this.state.docs.length;
            this.state.start = start;
        }
        this.state.list = this.state.docs.slice(this.state.start, this.state.end);
        sessionStorage.setItem('lastSearch', JSON.stringify(this.state));
        console.log(this.state);

        // console.log(this.state.list, this.state.start, this.state.end);
    }
    
    #prev() {
        // console.log(this.state.offset);

        let end = this.state.start;
        const start = end - 9;
        // end = start + 9;
        if (start < 0) {
           
            const newOffset = this.state.offset - 100;
            if(newOffset < 0) return;
            this.state.offset = newOffset;
            this.state.end = 99;
            this.state.start = 90;
            
            return;
        } else {
            this.state.end = end;
            this.state.start = start;
        }

        if (end < this.state.docs.length) {
            this.state.end = end;
            this.state.start = start;
            
        } else {
            this.state.start = start;
            this.state.end = this.state.docs.length - 1;
        }
        this.state.list = this.state.docs.slice(this.state.start, this.state.end);
        sessionStorage.setItem('lastSearch', JSON.stringify(this.state));
        console.log(this.state);
      
    }

    render() {
       
        if (!this.state.list.length) {
            return '';
        }

        this.el.classList.add('pagination');
        this.el.innerHTML = `
                <button class="pagination_prev">
                    <img src="/static/arrow_back.svg" />
                    Предыдущая страница
                </button>
                <button class="pagination_next">
                    Следующая страница
                    <img src="/static/arrow_next.svg" />
                </button>
        `;
        this.el.querySelectorAll('button')[0].addEventListener('click', this.#prev.bind(this))
        this.el.querySelectorAll('button')[1].addEventListener('click', this.#next.bind(this))
         sessionStorage.setItem('lastSearch', JSON.stringify(this.state));
        return this.el;
    }
}