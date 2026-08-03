package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.menu.dto.ProductRequest;
import com.example.cafemangmentsystem.menu.dto.ProductResponse;
import com.example.cafemangmentsystem.menu.entity.Category;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.CategoryRepository;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.station.entity.Station;
import com.example.cafemangmentsystem.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final StationRepository stationRepository;

    public ProductResponse create(ProductRequest request) {
        Product product = Product.builder()
                .category(getCategoryOrThrow(request.categoryId()))
                .station(getStationOrThrow(request.stationId()))
                .revenueLine(request.revenueLine())
                .nameAr(request.nameAr())
                .nameEn(request.nameEn())
                .price(request.price())
                .prepNote(request.prepNote())
                .build();

        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> findAll(Long categoryId) {
        List<Product> products = categoryId == null
                ? productRepository.findAll()
                : productRepository.findAllByCategoryId(categoryId);
        return products.stream().map(ProductResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse findById(Long id) {
        return ProductResponse.from(getOrThrow(id));
    }

    public ProductResponse update(Long id, ProductRequest request) {
        Product product = getOrThrow(id);
        product.setCategory(getCategoryOrThrow(request.categoryId()));
        product.setStation(getStationOrThrow(request.stationId()));
        product.setRevenueLine(request.revenueLine());
        product.setNameAr(request.nameAr());
        product.setNameEn(request.nameEn());
        product.setPrice(request.price());
        product.setPrepNote(request.prepNote());
        return ProductResponse.from(product);
    }

    public ProductResponse setAvailability(Long id, boolean available) {
        Product product = getOrThrow(id);
        product.setAvailable(available);
        return ProductResponse.from(product);
    }

    public ProductResponse deactivate(Long id, Long deactivatedByUserId) {
        Product product = getOrThrow(id);
        product.deactivate(deactivatedByUserId);
        return ProductResponse.from(product);
    }

    public ProductResponse activate(Long id) {
        Product product = getOrThrow(id);
        product.activate();
        return ProductResponse.from(product);
    }

    Product getOrThrow(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + id));
    }

    private Category getCategoryOrThrow(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category not found: " + categoryId));
    }

    private Station getStationOrThrow(Long stationId) {
        return stationRepository.findById(stationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Station not found: " + stationId));
    }
}