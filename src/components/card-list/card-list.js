import { DivComponent } from "../../common/div-component.js";
import { Card } from "../card/card.js";
import './card-list.css';

export class CardList extends DivComponent{
    constructor(appState, parentState) {
        super();
        this.appState = appState;
        this.parentState = parentState; //parentState - это состояние родительского элемента
    }

    render() {
        // sessionStorage.setItem('lastSearch', JSON.stringify(this.parentState));
        console.log(this.parentState)
        
        if(this.parentState.loading) {
            this.el.innerHTML = `<div class="card-list__loader">Загрузка...</div>`;
            return this.el;
        }

        
        console.log(this.parentState)

        this.el.classList.add('card-list');
        
        const cardGrid = document.createElement('div');
        cardGrid.classList.add('card_grid');
        this.el.append(cardGrid);
        for (const card of this.parentState.list) {
            cardGrid.append(new Card(this.appState, card).render());
        }
        
        return this.el;
    }
}